export type EmployeeRecord = {
  id: string;
  employeeNumber: number;
  displayName: string;
  pinHash: string;
  active: boolean;
  createdAt: string;
};

export type EmployeePublic = {
  id: string;
  employeeNumber: number;
  displayName: string;
};
