import { useState, useEffect } from "react";

const ONBOARDING_STORAGE_KEY = "family-portal-onboarding-completed";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    
    if (!hasCompletedOnboarding) {
      // Add a small delay to let the app load
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    markOnboardingComplete,
    resetOnboarding
  };
}