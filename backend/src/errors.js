export class AppError extends Error {
 constructor(code, message, status=400) { super(message); this.code=code; this.status=status; }
}
export function publicError(error) {
 if (error instanceof AppError) return {code:error.code,message:error.message};
 if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return {code:'TIMEOUT',message:'This step exceeded its time budget. Try a shorter clip or paste a distinctive spoken quote.'};
 return {code:'UNAVAILABLE',message:'A retrieval or provider step failed. Try again or supply a spoken quote.'};
}
