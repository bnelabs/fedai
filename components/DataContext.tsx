import React, { createContext, useContext, ReactNode, useRef } from 'react';
import { useLocationLogic } from '@/hooks/useLocationLogic';
import { useContextualData } from '@/hooks/useContextualData';
import { UserLocation, WeatherData, EnvironmentalData } from '@/types';

interface DataContextType {
  userLocation: UserLocation | null;
  locationPermission: string;
  locationStatusMessage: string;
  isLoadingLocation: boolean;
  fetchDeviceLocation: () => Promise<void>; // Added
  fetchIpLocationData: () => Promise<void>; // Added
  setManualLocation: (loc: { latitude: number; longitude: number; city?: string; country?: string }) => void;
  weatherData: WeatherData | null;
  isLoadingWeather: boolean;
  environmentalData: EnvironmentalData | null;
  isLoadingEnvironmental: boolean;
  isDataFullyLoaded: boolean;
  weatherDisplayTab: 'current' | 'recent' | 'historical';
  handleWeatherTabChange: (tab: 'current' | 'recent' | 'historical', refToFocus: React.RefObject<HTMLButtonElement>) => void;
  weatherTabCurrentRef: React.RefObject<HTMLButtonElement>;
  weatherTabRecentRef: React.RefObject<HTMLButtonElement>;
  weatherTabHistoricalRef: React.RefObject<HTMLButtonElement>;
  retryFetch: () => void; // Added for manual data refetch
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    userLocation,
    status: locationStatusMessage, // Renamed from 'status' to match expected name
    error: locationError, // Get error message from useLocationLogic
    fetchDeviceLocation,
    fetchIpLocationData,
    setManualLocation,
  } = useLocationLogic();

  // locationPermission is the error message (string) for backward compatibility
  const locationPermission = locationError || '';

  // Derive isLoadingLocation from status
  const isLoadingLocation = locationStatusMessage === 'idle' ||
                            locationStatusMessage === 'checking-permission' ||
                            locationStatusMessage === 'fetching-gps' ||
                            locationStatusMessage === 'fetching-ip';

  const {
    weatherData,
    isLoadingWeather,
    environmentalData,
    isLoadingEnvironmental,
    weatherDisplayTab,
    handleWeatherTabChange,
    weatherTabCurrentRef,
    weatherTabRecentRef,
    weatherTabHistoricalRef,
    retryFetch,
  } = useContextualData(userLocation);

  // Determine if all initial data loading is complete
  const isDataFullyLoaded = !isLoadingLocation && (!userLocation || (!isLoadingWeather && !isLoadingEnvironmental));

  const value = {
    userLocation,
    locationPermission,
    locationStatusMessage,
    isLoadingLocation,
    fetchDeviceLocation, // Added
    fetchIpLocationData, // Added
    setManualLocation, // Added
    weatherData,
    isLoadingWeather,
    environmentalData,
    isLoadingEnvironmental,
    isDataFullyLoaded,
    weatherDisplayTab,
    handleWeatherTabChange,
    weatherTabCurrentRef,
    weatherTabRecentRef,
    weatherTabHistoricalRef,
    retryFetch, // Added
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
