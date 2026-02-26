import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    labelClassName?: string;
    error?: string;
    prefix?: string;
    suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, labelClassName, error, prefix, suffix, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className={labelClassName || "block text-sm font-medium text-slate-700 mb-1"}>
                        {label}
                    </label>
                )}
                <div className="relative">
                    {props.type === 'select' ? (
                        <select
                            ref={ref as any}
                            className={`
                block w-full rounded-lg border-slate-300 shadow-sm 
                focus:border-emerald-500 focus:ring-emerald-500 
                disabled:bg-slate-50 disabled:text-slate-500
                transition-colors duration-200 h-10 px-3
                ${className}
              `}
                            {...(props as any)}
                        >
                            {props.children}
                        </select>
                    ) : (
                        <>
                            <input
                                ref={ref}
                                className={`
                  block w-full rounded-lg border-slate-300 shadow-sm 
                  focus:border-emerald-500 focus:ring-emerald-500 
                  disabled:bg-slate-50 disabled:text-slate-500
                  placeholder:text-slate-400
                  transition-colors duration-200
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                  ${prefix ? 'pl-7' : ''}
                  ${suffix ? 'pr-10' : ''}
                  ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                  ${className}
                `}
                                {...props}
                            />
                            {suffix && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10">
                                    {suffix}
                                </div>
                            )}
                        </>
                    )}
                </div>
                {error && (
                    <p className="mt-1 text-sm text-red-600 animate-fadeIn">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
