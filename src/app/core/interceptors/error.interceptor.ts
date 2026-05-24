import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMsg = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMsg = error.error.message;
      } else {
        // Server-side error
        if (error.status === 401) {
          errorMsg = 'غير مصرح لك بالدخول أو انتهت صلاحية الجلسة.';
        } else if (error.status === 403) {
          errorMsg = 'لا تملك الصلاحيات الكافية لإجراء هذه العملية.';
        } else if (error.error && typeof error.error === 'string') {
          errorMsg = error.error;
        } else if (error.error && error.error.message) {
          errorMsg = error.error.message;
        } else if (error.error && error.error.title) {
          errorMsg = error.error.title;
        } else if (error.status === 400) {
          errorMsg = 'البيانات المدخلة غير صحيحة.';
        } else if (error.status === 500) {
          errorMsg = 'حدث خطأ في الخادم الداخلي.';
        } else if (error.status === 0) {
          errorMsg = 'لا يمكن الاتصال بالخادم. تأكد من اتصالك بالإنترنت.';
        }
      }
      
      toast.error(errorMsg);
      return throwError(() => error);
    })
  );
};
