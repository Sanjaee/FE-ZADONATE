import React from "react";
import { Card } from "@/components/ui/card";
import { MapPin, ShoppingCart, CreditCard, Truck, Star } from "lucide-react";

export interface ProgressStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  completed: boolean;
  current: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  className = "",
}) => {
  // Find current step index
  const currentStepIndex = steps.findIndex((step) => step.current);

  // For mobile: show 3 steps (previous, current, next)
  const getMobileSteps = () => {
    if (currentStepIndex === -1) return steps.slice(0, 3); // Fallback to first 3 steps

    const startIndex = Math.max(0, currentStepIndex - 1);
    const endIndex = Math.min(steps.length, startIndex + 3);

    return steps.slice(startIndex, endIndex);
  };

  const mobileSteps = getMobileSteps();
  const mobileStartIndex = steps.findIndex(
    (step) => step.id === mobileSteps[0]?.id
  );

  return (
    <div className={`mb-8 ${className}`}>
      <Card>
        {/* Desktop View - Show all steps */}
        <div className="hidden md:flex items-start">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div className="relative flex-1 text-center">
                {/* Konten Step (Ikon dan Label) */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-500 ${
                      step.completed
                        ? "bg-green-100 border-2 border-green-500"
                        : step.current
                        ? "bg-green-500 shadow-lg"
                        : "bg-gray-100 border-2 border-gray-300"
                    }`}
                  >
                    <div
                      className={`transition-colors duration-500 ${
                        step.completed
                          ? "text-green-500"
                          : step.current
                          ? "text-white"
                          : "text-gray-400"
                      }`}
                    >
                      {step.icon}
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-xs md:text-sm transition-colors duration-500 ${
                      step.completed
                        ? "text-gray-600"
                        : step.current
                        ? "font-bold text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {/* Garis Penghubung ke step selanjutnya */}
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-6 left-1/2 w-full h-0.5 transition-all duration-1000 ease-in-out ${
                      step.completed ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Mobile View - Show only 3 steps */}
        <div className="flex md:hidden items-start">
          {mobileSteps.map((step, index) => {
            const originalIndex = mobileStartIndex + index;
            return (
              <React.Fragment key={step.id}>
                {/* Step */}
                <div className="relative flex-1 text-center">
                  {/* Konten Step (Ikon dan Label) */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 ${
                        step.completed
                          ? "bg-green-100 border-2 border-green-500"
                          : step.current
                          ? "bg-green-500 shadow-lg"
                          : "bg-gray-100 border-2 border-gray-300"
                      }`}
                    >
                      <div
                        className={`transition-colors duration-500 ${
                          step.completed
                            ? "text-green-500"
                            : step.current
                            ? "text-white"
                            : "text-gray-400"
                        }`}
                      >
                        {React.cloneElement(
                          step.icon as React.ReactElement<any>,
                          {
                            className: "w-5 h-5",
                          }
                        )}
                      </div>
                    </div>
                    <p
                      className={`mt-1 text-xs transition-colors duration-500 ${
                        step.completed
                          ? "text-gray-600"
                          : step.current
                          ? "font-bold text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {/* Garis Penghubung ke step selanjutnya */}
                  {index < mobileSteps.length - 1 && (
                    <div
                      className={`absolute top-5 left-1/2 w-full h-0.5 transition-all duration-1000 ease-in-out ${
                        step.completed ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// Predefined steps for different pages
export const CHECKOUT_STEPS: ProgressStep[] = [
  {
    id: "choose-item",
    title: "Choose Item",
    icon: <ShoppingCart className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "select-address",
    title: "Select Address",
    icon: <MapPin className="w-6 h-6" />,
    completed: false,
    current: true,
  },
  {
    id: "make-payment",
    title: "Make Payment",
    icon: <CreditCard className="w-6 h-6" />,
    completed: false,
    current: false,
  },
  {
    id: "order-shipped",
    title: "Order Shipped",
    icon: <Truck className="w-6 h-6" />,
    completed: false,
    current: false,
  },
  {
    id: "give-rating",
    title: "Give Rating",
    icon: <Star className="w-6 h-6" />,
    completed: false,
    current: false,
  },
];

export const PAYMENT_STEPS: ProgressStep[] = [
  {
    id: "choose-item",
    title: "Choose Item",
    icon: <ShoppingCart className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "select-address",
    title: "Select Address",
    icon: <MapPin className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "make-payment",
    title: "Make Payment",
    icon: <CreditCard className="w-6 h-6" />,
    completed: false,
    current: true,
  },
  {
    id: "order-shipped",
    title: "Order Shipped",
    icon: <Truck className="w-6 h-6" />,
    completed: false,
    current: false,
  },
  {
    id: "give-rating",
    title: "Give Rating",
    icon: <Star className="w-6 h-6" />,
    completed: false,
    current: false,
  },
];

export const SHIPPED_STEPS: ProgressStep[] = [
  {
    id: "choose-item",
    title: "Choose Item",
    icon: <ShoppingCart className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "select-address",
    title: "Select Address",
    icon: <MapPin className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "make-payment",
    title: "Make Payment",
    icon: <CreditCard className="w-6 h-6" />,
    completed: true,
    current: false,
  },
  {
    id: "order-shipped",
    title: "Order Shipped",
    icon: <Truck className="w-6 h-6" />,
    completed: false,
    current: true,
  },
  {
    id: "give-rating",
    title: "Give Rating",
    icon: <Star className="w-6 h-6" />,
    completed: false,
    current: false,
  },
];

// Hook to manage progress state
export const useProgressSteps = (initialSteps: ProgressStep[]) => {
  const [steps, setSteps] = React.useState<ProgressStep[]>(initialSteps);

  const updateStep = React.useCallback(
    (stepId: string, updates: Partial<ProgressStep>) => {
      setSteps((prevSteps) =>
        prevSteps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step
        )
      );
    },
    []
  );

  const markStepCompleted = React.useCallback((stepId: string) => {
    setSteps((prevSteps) => {
      const newSteps = prevSteps.map((step) => ({
        ...step,
        completed: step.id === stepId ? true : step.completed,
        current: step.id === stepId ? false : step.current,
      }));

      // Set next step as current
      const currentIndex = newSteps.findIndex((step) => step.id === stepId);
      if (currentIndex < newSteps.length - 1) {
        newSteps[currentIndex + 1].current = true;
      }

      return newSteps;
    });
  }, []);

  const setCurrentStep = React.useCallback((stepId: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => ({
        ...step,
        current: step.id === stepId,
      }))
    );
  }, []);

  return {
    steps,
    updateStep,
    markStepCompleted,
    setCurrentStep,
  };
};
