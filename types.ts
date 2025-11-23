export interface ProductItem {
  id: string;
  name: string;
  model: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  remark: string;
}

export interface ContractData {
  [key: string]: string | ProductItem[];
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  WIZARD = 'WIZARD',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
}

export interface FieldDefinition {
  originalTag: string;
  fieldName: string;
  isTable: boolean;
}