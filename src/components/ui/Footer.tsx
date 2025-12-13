import React from "react";

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = "" }) => {
  return (
    <footer className={`bg-white border-t border-gray-200 mt-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500 text-sm">
          <p>&copy; 2024 ZACloth. All rights reserved.</p>
          <p className="mt-2">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  );
};
