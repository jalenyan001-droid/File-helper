import { FieldDefinition, ProductItem } from '../types';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import Mammoth from 'mammoth';
import ExcelJS from 'exceljs';

// Regex to find content between {- and -}
const PLACEHOLDER_REGEX = /\{-([\s\S]+?)-\}/g;
const TABLE_KEYWORD = "商品信息表格";

export const extractFieldsFromDoc = async (file: File): Promise<FieldDefinition[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        const result = await Mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        
        const matches = Array.from(text.matchAll(PLACEHOLDER_REGEX));
        const uniqueFields = new Set<string>();
        const fields: FieldDefinition[] = [];

        matches.forEach(match => {
          const content = match[1].trim();
          if (!uniqueFields.has(content)) {
            uniqueFields.add(content);
            fields.push({
              originalTag: match[0],
              fieldName: content,
              isTable: content.includes(TABLE_KEYWORD)
            });
          }
        });

        fields.sort((a, b) => (a.isTable === b.isTable ? 0 : a.isTable ? 1 : -1));

        resolve(fields);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

export const extractFieldsFromExcel = async (file: File): Promise<FieldDefinition[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const uniqueFields = new Set<string>();
  const fields: FieldDefinition[] = [];

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        // Only process string or rich text cells
        if (cell.type === ExcelJS.ValueType.String || cell.type === ExcelJS.ValueType.RichText) {
          const text = cell.text || cell.value?.toString() || '';
          const matches = Array.from(text.matchAll(PLACEHOLDER_REGEX));
          
          matches.forEach(match => {
            const content = match[1].trim();
            if (!uniqueFields.has(content)) {
              uniqueFields.add(content);
              fields.push({
                originalTag: match[0],
                fieldName: content,
                isTable: content.includes(TABLE_KEYWORD)
              });
            }
          });
        }
      });
    });
  });

  fields.sort((a, b) => (a.isTable === b.isTable ? 0 : a.isTable ? 1 : -1));
  return fields;
};

const generateTableXml = (items: ProductItem[], total: number): string => {
  // Helper to create cell XML
  const createCell = (content: string | number, bold: boolean = false, align: string = 'center', gridSpan: number = 0) => {
    const boldXml = bold ? '<w:rPr><w:b/></w:rPr>' : '';
    const gridSpanXml = gridSpan > 0 ? `<w:gridSpan w:val="${gridSpan}"/>` : '';
    // Sanitize content: escape XML special characters
    const safeContent = String(content)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="0" w:type="auto"/>
          ${gridSpanXml}
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="${align}"/>
          </w:pPr>
          <w:r>
            ${boldXml}
            <w:t>${safeContent}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    `;
  };

  let xml = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>';

  // Header Row
  const headers = ['序号', '商品名称', '型号', '单位', '数量', '单价', '金额', '备注'];
  xml += '<w:tr>';
  headers.forEach(h => {
    xml += createCell(h, true, 'center');
  });
  xml += '</w:tr>';

  // Data Rows
  items.forEach((item, index) => {
    xml += '<w:tr>';
    xml += createCell(index + 1);
    xml += createCell(item.name);
    xml += createCell(item.model);
    xml += createCell(item.unit);
    xml += createCell(item.quantity);
    xml += createCell(item.price);
    xml += createCell(item.amount);
    xml += createCell(item.remark || '');
    xml += '</w:tr>';
  });

  // Total Row
  xml += '<w:tr>';
  xml += createCell('合计：', true, 'right', 6); // Span first 6 cols
  xml += createCell(total, true, 'center');
  xml += createCell('', false, 'center'); // Empty remark cell
  xml += '</w:tr>';

  xml += '</w:tbl>';
  return xml;
};

export const generateFilledDocument = async (
  file: File, 
  data: Record<string, any>, 
  tableData?: { items: ProductItem[], total: number },
  fields?: FieldDefinition[]
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as ArrayBuffer;
        if (!content || content.byteLength === 0) {
            throw new Error("Cannot read file content");
        }
        
        // 1. Prepare Data
        // We use a unique placeholder string for the table. 
        // Docxtemplater will replace the tag with this string, preserving the document structure.
        // Then we find this string in the XML and swap it with the real table.
        const tablePlaceholder = "___INSERT_TABLE_HERE_" + Math.floor(Math.random() * 100000) + "___";
        const templateData = { ...data };
        
        const tableField = fields?.find(f => f.isTable);
        if (tableField) {
            templateData[tableField.fieldName] = tablePlaceholder;
        }

        // 2. Run Docxtemplater
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: '{-', end: '-}' }
        });

        // Render the text fields and the table placeholder
        doc.render(templateData);

        // 3. XML DOM Manipulation for Table Insertion
        const outZip = doc.getZip();
        const docXmlContent = outZip.file("word/document.xml")?.asText();

        if (docXmlContent && tableField && tableData) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(docXmlContent, "text/xml");
            
            // Find all text nodes
            const textNodes = xmlDoc.getElementsByTagName("w:t");
            let targetParagraph: Node | null = null;

            // Search for the placeholder
            for (let i = 0; i < textNodes.length; i++) {
                if (textNodes[i].textContent === tablePlaceholder) {
                    // Found the placeholder. Traverse up to the paragraph (<w:p>)
                    let currentNode: Node | null = textNodes[i];
                    while (currentNode && currentNode.nodeName !== "w:p") {
                        currentNode = currentNode.parentNode;
                    }
                    if (currentNode && currentNode.nodeName === "w:p") {
                        targetParagraph = currentNode;
                        break;
                    }
                }
            }

            if (targetParagraph) {
                // Generate the Table XML string
                const tableXmlBody = generateTableXml(tableData.items, tableData.total);
                
                // Wrap it in a root element with namespaces to parse it correctly
                const wrappedTableXml = `<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${tableXmlBody}</root>`;
                const tempDoc = parser.parseFromString(wrappedTableXml, "text/xml");
                const tableNode = tempDoc.getElementsByTagName("w:tbl")[0];

                if (tableNode && targetParagraph.parentNode) {
                    // Replace the paragraph with the table
                    // Using importNode to ensure it belongs to the main document
                    const importedNode = xmlDoc.importNode(tableNode, true);
                    targetParagraph.parentNode.replaceChild(importedNode, targetParagraph);
                    
                    // Serialize back to string
                    const serializer = new XMLSerializer();
                    const newDocXml = serializer.serializeToString(xmlDoc);
                    
                    // Update the zip
                    outZip.file("word/document.xml", newDocXml);
                }
            } else {
                console.warn("Table placeholder not found in rendered XML. The tag might have been removed or altered.");
            }
        }

        // 4. Generate Final Blob
        const blob = outZip.generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        resolve(blob);
      } catch (error) {
        console.error("Error generating doc:", error);
        reject(error);
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
};

export const generateFilledExcel = async (
  file: File,
  data: Record<string, any>,
  tableData?: { items: ProductItem[], total: number },
  fields?: FieldDefinition[]
): Promise<Blob> => {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const tableField = fields?.find(f => f.isTable);

  workbook.eachSheet((worksheet) => {
    let tableInsertionRow = -1;
    // Iterate rows to find text placeholders and the table placeholder
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
         if (cell.type === ExcelJS.ValueType.String || cell.type === ExcelJS.ValueType.RichText) {
             let text = cell.text;

             // Check for Table Placeholder
             if (tableField && text.includes(tableField.originalTag)) {
                 tableInsertionRow = rowNumber;
                 cell.value = null; // Clear placeholder
             }

             // Replace standard text placeholders
             let modified = false;
             const matches = Array.from(text.matchAll(PLACEHOLDER_REGEX));
             for (const match of matches) {
                 const key = match[1].trim();
                 if (data[key] !== undefined) {
                     text = text.replace(match[0], data[key]);
                     modified = true;
                 }
             }
             if (modified) {
                 cell.value = text;
             }
         }
      });
    });

    // Insert Table Data if placeholder was found
    if (tableInsertionRow !== -1 && tableData) {
        const headers = ['序号', '商品名称', '型号', '单位', '数量', '单价', '金额', '备注'];
        
        // 1. Insert Header Row at the placeholder location
        const headerRow = worksheet.getRow(tableInsertionRow);
        // Overwrite existing row values with headers
        headerRow.values = headers; 
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        headerRow.commit();

        // 2. Insert Data Rows immediately after
        let currentRowIdx = tableInsertionRow + 1;
        
        tableData.items.forEach((item, idx) => {
            const rowValues = [
                idx + 1,
                item.name,
                item.model,
                item.unit,
                item.quantity,
                item.price,
                item.amount,
                item.remark
            ];
            // Insert new row, pushing existing content down
            worksheet.insertRow(currentRowIdx, rowValues);
            const r = worksheet.getRow(currentRowIdx);
            r.alignment = { horizontal: 'center' };
            r.commit();
            currentRowIdx++;
        });

        // 3. Insert Total Row
        const totalRowValues = ['合计', '', '', '', '', '', tableData.total, ''];
        worksheet.insertRow(currentRowIdx, totalRowValues);
        const totalRow = worksheet.getRow(currentRowIdx);
        totalRow.font = { bold: true };
        totalRow.alignment = { horizontal: 'right' };
        totalRow.getCell(7).alignment = { horizontal: 'center' }; // Center the amount
        totalRow.commit();
    }
  });

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const generateExcelTable = (items: ProductItem[], total: number): Blob => {
  const header = ['序号', '商品名称', '型号', '单位', '数量', '单价', '金额', '备注'];
  const rows = items.map((item, index) => [
    index + 1,
    item.name,
    item.model,
    item.unit,
    item.quantity,
    item.price,
    item.amount,
    item.remark
  ]);
  
  rows.push(['', '', '', '', '', '合计', total, '']);

  const csvContent = [
    header.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  return blob;
};