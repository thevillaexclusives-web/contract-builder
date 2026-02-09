import type { Database } from './database'

// Contract-related types derived from database schema
export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row']
export type ContractTemplateInsert = Database['public']['Tables']['contract_templates']['Insert']
export type ContractTemplateUpdate = Database['public']['Tables']['contract_templates']['Update']

export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractInsert = Database['public']['Tables']['contracts']['Insert']
export type ContractUpdate = Database['public']['Tables']['contracts']['Update']

export type ContractVersion = Database['public']['Tables']['contract_versions']['Row']
export type ContractVersionInsert = Database['public']['Tables']['contract_versions']['Insert']
export type ContractVersionUpdate = Database['public']['Tables']['contract_versions']['Update']
