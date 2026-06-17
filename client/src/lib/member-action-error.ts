export class MemberActionError extends Error {
  details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "MemberActionError";
    this.details = details;
  }
}
