import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, prefix, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {prefix && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium z-10">
                            {prefix}
                        </span>
                    )}
                    <input
                        ref={ref}
                        className={`
              block w-full rounded-lg border-slate-300 shadow-sm 
              focus:border-emerald-500 focus:ring-emerald-500 
              disabled:bg-slate-50 disabled:text-slate-500
              placeholder:text-slate-400
              transition-colors duration-200
              ${prefix ? 'pl-7' : ''}
              ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
              ${className}
            `}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1 text-sm text-red-600 animate-fadeIn">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
