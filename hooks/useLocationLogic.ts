
import { useState, useEffect, useCallback } from 'react';
import { type UserLocation } from '@/types';
import { fetchIpLocation } from '@/services/ipLocationService';
import { useLocalizationContext } from '@/components/LocalizationContext.tsx';
import { GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS, GEOLOCATION_MAXIMUM_AGE_MS } from '../constants';

export type LocationFetchStatus = 'idle' | 'checking-permission' | 'fetching-ip' | 'awaiting-permission' | 'fetching-gps' | 'success' | 'error-permission' | 'error-fetch' | 'error-ip-fetch';

export function useLocationLogic() {
  const { uiStrings } = useLocalizationContext(); 
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationFetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchIpLocationData = useCallback(async (isEnrichmentOnly = false) => {
    if (!isEnrichmentOnly && userLocation?.source === 'gps') {
        // If we already have GPS and this is not an enrichment call, no need to fetch IP.
        return;
    }

    if (!isEnrichmentOnly) {
      setStatus('fetching-ip');
      setError(null);
    }
    // setIsLoadingLocation(true); // Derived from status
    
    const { location, serviceName, error: fetchError } = await fetchIpLocation();
    if (location && serviceName) {
      console.log(`// DEBUG_LOG: IP Fetch Success - isEnrichmentOnly: ${isEnrichmentOnly}, location: ${JSON.stringify(location)}`);
      const ipLocationWithDetail: UserLocation = {
        ...location, 
        accuracyMessage: uiStrings.locationStatusSuccessIp(location.city || 'Unknown City', location.country || 'Unknown Country', serviceName)
      };

      setUserLocation(prev => {
          if (isEnrichmentOnly && prev?.source === 'gps') {
              // Enrich existing GPS data with city/country info
              return {
                  ...prev,
                  city: ipLocationWithDetail.city,
                  country: ipLocationWithDetail.country,
                  countryCode: ipLocationWithDetail.countryCode,
                  accuracyMessage: prev.accuracyMessage,
              };
          }
          return ipLocationWithDetail;
      });
      if (!isEnrichmentOnly) {
          setStatus('success'); // IP fetch was successful
      }
    } else {
      // Error fetching IP location
      console.log(`// DEBUG_LOG: IP Fetch Error - isEnrichmentOnly: ${isEnrichmentOnly}, error: ${fetchError}`);
      if (!isEnrichmentOnly) {
        // Only set error status if this was a primary fetch, not just enrichment.
        setUserLocation(null);
        setStatus('error-ip-fetch');
      }
      let baseErrorMessage = uiStrings.locationErrorGeneral;
      if (fetchError && fetchError.toLowerCase().includes('failed to fetch')) {
        baseErrorMessage = `${uiStrings.ipLocationFailed} ${uiStrings.locationErrorGeneral.toLowerCase().replace('could not determine location. p', 'P')} Please check your network settings.`;
      } else if (fetchError) {
        baseErrorMessage = `${uiStrings.ipLocationFailed}: ${fetchError}`;
      }
      setError(baseErrorMessage);
    }
    // setIsLoadingLocation(false); // Derived from status
  }, [uiStrings, userLocation?.source, setError, setStatus, setUserLocation]);


  const fetchDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error-permission');
      setError(uiStrings.locationPermissionUnavailableUserMessage);
      fetchIpLocationData(false); // Attempt IP fallback if geolocation is not available
      return;
    }

    setStatus('fetching-gps');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'gps',
          accuracyMessage: uiStrings.locationStatusSuccessGps(position.coords.latitude, position.coords.longitude),
        };
        setUserLocation(newLocation);
        setStatus('success'); // GPS fetch was successful
        if (!newLocation.city || !newLocation.countryCode) { // Check if enrichment is needed
            fetchIpLocationData(true); // true for enrichment
        }
      },
      (gpsError) => {
        console.log(`// DEBUG_LOG: GPS Error - Code: ${gpsError.code}, Message: ${gpsError.message}. Attempting IP fallback.`);
        console.error('[Fedai Location Hook] navigator.geolocation.getCurrentPosition error. Code:', gpsError.code, 'Message:', gpsError.message);
        
        if (gpsError.code === gpsError.PERMISSION_DENIED) {
            setError(uiStrings.locationPermissionDeniedUserMessage);
            setStatus('error-permission');
        } else {
            let detailedError = uiStrings.locationErrorGeneral;
            if (gpsError.message && gpsError.message.toLowerCase().includes('failed to fetch')) {
              detailedError += ` (Network error. Check connection.)`;
            } else if (gpsError.message) {
              detailedError += ` (${gpsError.message})`;
            }
            setError(detailedError);
            setStatus('error-fetch'); // General fetch error for GPS
        }
        fetchIpLocationData(false); // Attempt IP fallback on any GPS error
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS, maximumAge: GEOLOCATION_MAXIMUM_AGE_MS }
    );
  }, [uiStrings, fetchIpLocationData, setError, setStatus, setUserLocation]);

  // Main effect for initializing location fetching and handling permission changes.
  useEffect(() => {
    let permissionStatusRef: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (permissionStatusRef) {
        const newBrowserStatus = permissionStatusRef.state;

        if (newBrowserStatus === 'granted') {
            setStatus('fetching-gps');
            setError(null);
            fetchDeviceLocation();
        } else if (newBrowserStatus === 'denied') {
            setStatus('error-permission');
            setError(uiStrings.locationPermissionDeniedUserMessage);
            fetchIpLocationData(false);
        } else if (newBrowserStatus === 'prompt'){
            setStatus('awaiting-permission');
            setUserLocation(null);
            setError(null);
        } else { // 'unavailable' or other states.
            setStatus('error-permission');
            setError(uiStrings.locationPermissionUnavailableUserMessage);
            fetchIpLocationData(false);
        }
      }
    };

    if (!navigator.permissions || !navigator.permissions.query) {
      console.warn("[Fedai Location Hook] Permissions API not supported. Defaulting to 'unavailable' and attempting IP-based location.");
      setStatus('error-permission');
      setError(uiStrings.locationPermissionUnavailableUserMessage);
      fetchIpLocationData(false);
      return;
    }

    setStatus('checking-permission');
    setError(null);

    navigator.permissions.query({ name: 'geolocation' }).then((browserPermissionStatus) => {
      permissionStatusRef = browserPermissionStatus;
      const initialBrowserStatus = browserPermissionStatus.state;

      if (initialBrowserStatus === 'granted') {
          setStatus('fetching-gps');
          setError(null);
          fetchDeviceLocation();
      } else if (initialBrowserStatus === 'prompt') {
          setStatus('awaiting-permission');
          setError(null);
          // Automatically fall back to IP location while waiting for user decision
          // This ensures the app works immediately without requiring GPS permission
          fetchIpLocationData(false);
      } else if (initialBrowserStatus === 'denied') {
          setStatus('error-permission');
          setError(uiStrings.locationPermissionDeniedUserMessage);
          fetchIpLocationData(false); // Fallback to IP
      } else { // 'unavailable' or other states.
          setStatus('error-permission');
          setError(uiStrings.locationPermissionUnavailableUserMessage);
          fetchIpLocationData(false); // Fallback to IP
      }

      browserPermissionStatus.onchange = handlePermissionChange;

    }).catch((err) => {
        console.error('[Fedai Location Hook] Error querying geolocation permission:', err);
        console.log(`// DEBUG_LOG: Permissions query error - Error: ${err}`);
        setUserLocation(null);
        setStatus('error-permission');
        setError(uiStrings.locationPermissionUnavailableUserMessage + " " + (uiStrings.locationErrorGeneral || "Could not query permission."));
        fetchIpLocationData(false); // Fallback to IP
    });
    
    return () => {
      if (permissionStatusRef) {
        permissionStatusRef.onchange = null;
      }
    };
  // Dependencies for the main useEffect:
  // - uiStrings: For error messages.
  // - fetchDeviceLocation, fetchIpLocationData: Core actions.
  // - setError, setStatus, setUserLocation: State setters.
  // - Note: `userLocation` itself is not a direct dependency for re-triggering this permission flow.
  //   Changes to `userLocation` are results of these functions, not triggers for re-evaluating permissions.
  }, [uiStrings, fetchDeviceLocation, fetchIpLocationData, setError, setStatus, setUserLocation]);
  
  // DEBUG_LOG: Effect for logging state changes
  useEffect(() => {
    console.log(`// DEBUG_LOG: State Change - userLocation: ${JSON.stringify(userLocation)}, status: ${status}, error: "${error}"`);
  }, [userLocation, status, error]);

  /**
   * Set a manually-entered location (user typed a city or coordinates).
   * Used when GPS + IP detection both fail — the app asks the user.
   */
  const setManualLocation = useCallback((loc: { latitude: number; longitude: number; city?: string; country?: string }) => {
    const manual: UserLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      source: 'manual',
      city: loc.city,
      country: loc.country,
      accuracyMessage: 'Manual location entered by user'
    };
    setUserLocation(manual);
    setStatus('success');
    setError(null);
  }, []);

  return {
    userLocation,
    status,
    error,
    fetchDeviceLocation,
    fetchIpLocationData,
    setManualLocation,
  };
}
