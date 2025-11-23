import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { ProductItem } from '../types';

interface ProductTableProps {
  initialData?: ProductItem[];
  onSave: (items: ProductItem[], total: number) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ initialData, onSave }) => {
  const [items, setItems] = useState<ProductItem[]>(initialData || [
    { id: '1', name: '', model: '', unit: '个', quantity: 1, price: 0, amount: 0, remark: '' }
  ]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + item.amount, 0);
    setTotal(newTotal);
    onSave(items, newTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleInputChange = (id: string, field: keyof ProductItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updates: any = { [field]: value };
      
      // Auto-calculate amount if quantity or price changes
      if (field === 'quantity' || field === 'price') {
        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const price = field === 'price' ? Number(value) : item.price;
        updates.amount = Number((qty * price).toFixed(2));
      }

      return { ...item, ...updates };
    }));
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { 
        id: Date.now().toString(), 
        name: '', 
        model: '', 
        unit: '个', 
        quantity: 1, 
        price: 0, 
        amount: 0, 
        remark: '' 
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="w-full flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          商品信息录入
        </h3>
        <span className="text-sm text-gray-500">自动计算金额</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100">
            <tr>
              <th className="px-2 py-3 rounded-l-lg w-12">序号</th>
              <th className="px-2 py-3">商品名称</th>
              <th className="px-2 py-3 w-24">型号</th>
              <th className="px-2 py-3 w-16">单位</th>
              <th className="px-2 py-3 w-20">数量</th>
              <th className="px-2 py-3 w-24">单价(元)</th>
              <th className="px-2 py-3 w-24">金额(元)</th>
              <th className="px-2 py-3">备注</th>
              <th className="px-2 py-3 rounded-r-lg w-12">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                <td className="px-2 py-2 text-center font-medium">{index + 1}</td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1"
                    placeholder="请输入名称"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={item.model}
                    onChange={(e) => handleInputChange(item.id, 'model', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1"
                    placeholder="型号"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleInputChange(item.id, 'unit', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1 text-center"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleInputChange(item.id, 'quantity', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1 text-right"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1 text-right"
                  />
                </td>
                <td className="px-2 py-2 font-medium text-gray-900 text-right">
                  {item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={item.remark}
                    onChange={(e) => handleInputChange(item.id, 'remark', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-1"
                    placeholder="无"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-gray-900 bg-gray-50">
              <td colSpan={6} className="px-4 py-3 text-right text-base">合计:</td>
              <td className="px-2 py-3 text-right text-lg text-blue-700">
                {total.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={addItem}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors w-full justify-center border border-dashed border-blue-300"
        >
          <Plus className="w-4 h-4" />
          添加商品行
        </button>
      </div>
    </div>
  );
};

export default ProductTable;
