import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  ArrowRight, 
  CheckCircle, 
  Download, 
  Sparkles, 
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import ProductTable from './components/ProductTable';
import { extractFieldsFromDoc, generateFilledDocument, generateExcelTable } from './services/docService';
import { enhanceText, suggestTableData } from './services/geminiService';
import { AppStep, FieldDefinition, ProductItem } from './types';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [tableData, setTableData] = useState<{ items: ProductItem[], total: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === AppStep.WIZARD && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentFieldIndex, step]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStep(AppStep.ANALYZING);
    setError(null);

    try {
      const extractedFields = await extractFieldsFromDoc(uploadedFile);
      if (extractedFields.length === 0) {
        setError("未能在文档中找到 {--字段--} 格式的标记。请检查模板。");
        setStep(AppStep.UPLOAD);
        return;
      }
      setFields(extractedFields);
      setStep(AppStep.WIZARD);
    } catch (err: any) {
      console.error(err);
      let msg = "解析文档失败，请确保是有效的 .docx 文件";
      if (err.message && err.message.includes("document part")) {
         msg = "解析错误: 无法找到文档主体，请确保上传的是有效的 Word (.docx) 文件";
      } else if (err.message) {
         msg = `解析错误: ${err.message}`;
      }
      setError(msg);
      setStep(AppStep.UPLOAD);
    }
  };

  const handleNext = () => {
    if (currentFieldIndex < fields.length - 1) {
      setCurrentFieldIndex(prev => prev + 1);
    } else {
      setStep(AppStep.GENERATING);
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(prev => prev - 1);
    }
  };

  const handleInputChange = (value: string) => {
    const currentField = fields[currentFieldIndex];
    setFormData(prev => ({
      ...prev,
      [currentField.fieldName]: value
    }));
  };

  const handleAiPolish = async () => {
    const currentField = fields[currentFieldIndex];
    const currentValue = formData[currentField.fieldName] || '';
    
    setAiLoading(true);
    try {
      const polished = await enhanceText(currentField.fieldName, currentValue);
      handleInputChange(polished);
    } catch (err) {
      // Quietly fail
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      // Pass fields to generateFilledDocument so it knows which tag is the table
      const docBlob = await generateFilledDocument(file, formData, tableData || undefined, fields);
      
      setStep(AppStep.COMPLETED);
      
      const url = URL.createObjectURL(docBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Generated_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(err);
      let msg = "生成文档时出错。";
      if (err.properties && err.properties.errors) {
          msg = "文档模板错误: " + err.properties.errors.map((e: any) => e.message).join('; ');
      } else if (err.message) {
          msg = "生成错误: " + err.message;
      }
      setError(msg);
      setStep(AppStep.WIZARD);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadExcel = () => {
    if (!tableData) return;
    const blob = generateExcelTable(tableData.items, tableData.total);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Product_Table.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderUploadStep = () => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in">
      <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">上传合同模板</h2>
        <p className="text-gray-500 mb-8">
          请上传 .docx 文件，系统将自动识别 <span className="font-mono bg-gray-100 px-1 rounded">{`{--字段--}`}</span> 标记
        </p>
        
        <label className="relative group cursor-pointer w-full">
          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-300">
            <div className="flex flex-col items-center">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
              <span className="text-sm text-gray-500 group-hover:text-blue-600 font-medium">点击或拖拽上传</span>
            </div>
          </div>
          <input type="file" className="hidden" accept=".docx" onChange={handleFileUpload} />
        </label>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );

  const renderWizardStep = () => {
    const currentField = fields[currentFieldIndex];
    const progress = ((currentFieldIndex + 1) / fields.length) * 100;
    const isTable = currentField.isTable;

    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                字段 {currentFieldIndex + 1} / {fields.length}
              </span>
              <h2 className="text-2xl font-bold text-gray-800 mt-1">
                {isTable ? "填写表格数据" : `请输入: ${currentField.fieldName}`}
              </h2>
            </div>
            {!isTable && (
               <button 
                 onClick={handleAiPolish}
                 disabled={aiLoading}
                 className="flex items-center gap-2 text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg text-sm transition-colors"
               >
                 {aiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                 AI 润色
               </button>
            )}
          </div>

          <div className="flex-1 p-6 overflow-auto bg-gray-50/50">
            {isTable ? (
              <div className="h-full">
                <ProductTable 
                  initialData={tableData?.items}
                  onSave={(items, total) => setTableData({ items, total })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-2xl mx-auto mt-8">
                <label className="text-sm font-medium text-gray-700">
                  {currentField.fieldName} 内容:
                </label>
                <textarea
                  ref={inputRef as any}
                  value={formData[currentField.fieldName] || ''}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[150px] text-lg shadow-sm"
                  placeholder={`在此输入 ${currentField.fieldName}...`}
                />
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={currentFieldIndex === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${
                currentFieldIndex === 0 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              上一步
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium shadow-md shadow-blue-200 transition-all hover:scale-105 active:scale-95"
            >
              {currentFieldIndex === fields.length - 1 ? '完成并生成' : '下一步'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCompletedStep = () => (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in">
      <div className="bg-white p-12 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">生成完毕!</h2>
        <p className="text-gray-500 mb-8">
          您的文档已自动下载。表格已成功插入到文档中。
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => setStep(AppStep.UPLOAD)}
            className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            处理新文件
          </button>
          
          {tableData && (
            <button 
              onClick={downloadExcel}
              className="w-full py-3 px-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              额外下载表格数据 (CSV)
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-800 font-sans">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center px-8 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Smart Contract Filler
          </h1>
        </div>
      </header>

      <main className="pt-16 h-screen overflow-hidden">
        {step === AppStep.UPLOAD && renderUploadStep()}
        {step === AppStep.ANALYZING && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">正在解析文档结构...</p>
          </div>
        )}
        {step === AppStep.WIZARD && renderWizardStep()}
        {step === AppStep.GENERATING && (
          <div className="flex flex-col items-center justify-center h-full">
             <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
             <p className="text-gray-600 font-medium">正在生成最终文档...</p>
          </div>
        )}
        {step === AppStep.COMPLETED && renderCompletedStep()}
      </main>
    </div>
  );
};

export default App;
