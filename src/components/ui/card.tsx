import React from "react";

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`
        bg-gray-900
        border border-gray-800
        rounded-2xl
        shadow-lg
        transition-shadow
        hover:shadow-xl
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`
        p-6
        text-gray-200
        font-sans
        ${className}
      `}
    >
      {children}
    </div>
  );
}