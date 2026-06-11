export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

export interface PageQuery {
  page?: number;
  size?: number;
  keyword?: string;
  content?: string;
  status?: string | number;
  all?: boolean;
  noPage?: boolean;
}
