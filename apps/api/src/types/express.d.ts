// TODO: Express request type augmentation stub (Phase 0)
declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      role: string;
    };
  }
}
