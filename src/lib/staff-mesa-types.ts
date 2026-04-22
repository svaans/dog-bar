export type StaffMesaAssignment = {
  mesa: number;
  staffName: string;
  /** Momento inicial en el que se “entró” a la mesa. */
  joinedAt: string;
  /** Última señal/refresh para mantenerla “viva”. */
  updatedAt: string;
};
