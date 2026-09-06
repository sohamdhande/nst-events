import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { apiClient } from '../../../../src/infrastructure/api';
import { getPersistentDeviceId } from '../../../../src/lib/device-id';
import { CameraPermissionView } from '../../../../src/ui/CameraPermissionView';
import { LocationPermissionView } from '../../../../src/ui/LocationPermissionView';
import { ScannerOverlay } from '../../../../src/ui/ScannerOverlay';
import { AttendanceVerificationView } from '../../../../src/ui/AttendanceVerificationView';
import { AttendanceSuccessView } from '../../../../src/ui/AttendanceSuccessView';
import { AttendanceFailureView } from '../../../../src/ui/AttendanceFailureView';

type ScanFlowState =
  | 'CHECKING'
  | 'CAMERA_PERMISSION'
  | 'LOCATION_PERMISSION'
  | 'SCANNING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILURE';

export default function ScanAttendanceScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [flowState, setFlowState] = useState<ScanFlowState>('CHECKING');
  const [torchActive, setTorchActive] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('ACQUIRING LOCATION...');

  const [errorCode, setErrorCode] = useState<string>('ATTENDANCE_FAILED');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sessionDetails, setSessionDetails] = useState<{
    locationName?: string;
    timeLogged?: string;
  }>({});

  const isProcessingRef = useRef(false);
  const pendingQrDataRef = useRef<string | null>(null);
  const locationCacheRef = useRef<Location.LocationObject | null>(null);
  const locationPromiseRef = useRef<Promise<Location.LocationObject> | null>(null);

  const prefetchLocation = async () => {
    if (locationPromiseRef.current) return locationPromiseRef.current;
    const promise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    locationPromiseRef.current = promise;
    promise.then(loc => {
      locationCacheRef.current = loc;
    }).catch(() => {
      locationPromiseRef.current = null;
    });
    return promise;
  };

  useEffect(() => {
    (async () => {
      if (!cameraPermission) return;
      if (!cameraPermission.granted) {
        setFlowState('CAMERA_PERMISSION');
        return;
      }
      
      const locPerm = await Location.getForegroundPermissionsAsync();
      if (!locPerm.granted) {
        setFlowState('LOCATION_PERMISSION');
        return;
      }
      
      setFlowState('SCANNING');
      console.log(`\n[Attendance][Timing] Scanner opened timestamp: ${Date.now()}`);
      prefetchLocation();
    })();
  }, [cameraPermission]);

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    pendingQrDataRef.current = data;

    console.log(`\n[Attendance] =======================================`);
    console.log(`[Attendance][QR] Raw payload scanned:`, data);

    processAttendanceSubmission(data);
  };

  const processAttendanceSubmission = async (qrData: string) => {
    setFlowState('VERIFYING');

    try {
      // 1. Verify QR Format
      const trimmedQrData = qrData.trim();
      if (!trimmedQrData.startsWith('v1:')) {
        console.log(`[Attendance][Error] Invalid QR Format: missing v1 prefix`);
        throw new Error('INVALID_QR_FORMAT');
      }
      const parts = trimmedQrData.split(':');
      if (parts.length !== 3) {
        console.log(`[Attendance][Error] Malformed QR: Expected 3 parts, got ${parts.length}`);
        throw new Error('MALFORMED_QR');
      }
      const sessionId = parts[1];
      console.log(`[Attendance][QR] Parsed session_id: ${sessionId}`);
      console.log(`[Attendance][QR] Parsed totp_token (full string): ${trimmedQrData}`);

      // 2. Request Location Permission & High-Accuracy Position
      setVerificationStatus('ACQUIRING LOCATION...');
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      console.log(`[Attendance][Location] Permission status:`, locationStatus);
      if (locationStatus !== 'granted') {
        console.log(`[Attendance][Location] Permission denied, redirecting to permission screen.`);
        setFlowState('LOCATION_PERMISSION');
        isProcessingRef.current = false;
        return;
      }

      const locationReqStart = Date.now();
      console.log(`[Attendance][Timing] Location request started timestamp: ${locationReqStart}`);

      let location: Location.LocationObject | null = null;

      // 1. Try Cache First
      if (locationCacheRef.current) {
        const cached = locationCacheRef.current;
        const accuracy = cached.coords.accuracy ?? 9999;
        const age = Date.now() - cached.timestamp;
        
        // Only use cache if it's less than 100m accuracy and relatively fresh (e.g., < 60s)
        if (accuracy <= 100 && age < 60000) {
          console.log(`[Attendance][Location] Using acceptable pre-fetched location (Accuracy: ${accuracy}m, Age: ${age}ms)`);
          location = cached;
        } else {
          console.log(`[Attendance][Location] Discarding pre-fetched location (Accuracy: ${accuracy}m, Age: ${age}ms)`);
          locationCacheRef.current = null;
        }
      }

      // 2. Fetch Fresh if Cache was missing or discarded
      if (!location) {
        console.log(`[Attendance][Location] Fetching fresh high-accuracy location with 8s timeout...`);
        const locPromise = locationPromiseRef.current || Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), 8000)
        );
        location = await Promise.race([locPromise, timeoutPromise]);
      }

      console.log(`[Attendance][Location] Data: latitude=${location.coords.latitude}, longitude=${location.coords.longitude}, gps_accuracy=${location.coords.accuracy}, mock_location_detected=${location.mocked}`);

      // 3. Client-side accuracy enforcement (must be <= 100m)
      const finalAccuracy = location.coords.accuracy ?? 9999;
      if (finalAccuracy > 100) {
        console.log(`[Attendance][Location] Client-side rejection: Accuracy (${finalAccuracy}m) is worse than 100m threshold.`);
        throw new Error('LOCATION_UNRELIABLE');
      }
      
      console.log(`[Attendance][Location] Client-side assessment: Location accepted.`);

      // 3. Fetch Persistent Device ID
      setVerificationStatus('VERIFYING WITH SERVER...');
      const deviceId = await getPersistentDeviceId();
      console.log(`[Attendance] Device ID:`, deviceId);

      // 4. Submit payload to backend (POST /v1/attendance/mark)
      const payload = {
        session_id: sessionId,
        totp_token: trimmedQrData,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        device_id: deviceId,
        device_os: Platform.OS,
        gps_accuracy: location.coords.accuracy || 0,
        mock_location_detected: location.mocked || false,
        app_version: '1.0.0',
      };

      console.log(`[Attendance][API] Request starting: POST /v1/attendance/mark`);
      console.log(`[Attendance][Timing] exact backend request timestamp: ${Date.now()}`);
      console.log(`[Attendance][API] Payload:`, JSON.stringify(payload));

      const response: any = await apiClient('/v1/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      console.log(`[Attendance][API] HTTP Status: 200 (Success)`);
      console.log(`[Attendance][API] Response body:`, JSON.stringify(response));

      console.log(`[Attendance][API] Fetching event details: GET /v1/events/${eventId}`);
      const eventResponse: any = await apiClient(`/v1/events/${eventId}`);

      setSessionDetails({
        locationName: eventResponse?.locationName || 'Unknown Location',
        timeLogged: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      console.log(`[Attendance][Result] Success details:`, response);
      console.log(`[Attendance][Result] UI State: SUCCESS`);
      setFlowState('SUCCESS');
    } catch (err: any) {
      console.log(`[Attendance][API] Raw error caught:`, err);
      console.log(`[Attendance][API] HTTP Status:`, err.status || 'unknown');
      console.log(`[Attendance][API] Error body:`, err.body ? JSON.stringify(err.body) : 'none');
      console.log(`[Attendance][Error] full parsed backend error body/code/message:`, err.message);

      let rawMsg = err.message || 'ATTENDANCE_FAILED';
      let parsedCode = 'ATTENDANCE_FAILED';

      if (err.body && err.body.code) {
        parsedCode = err.body.code;
      } else if (err.body && err.body.error) {
        parsedCode = err.body.error;
      }

      if (rawMsg.includes('LOCATION_TIMEOUT')) {
        parsedCode = 'LOCATION_TIMEOUT';
        rawMsg = 'Location request timed out. Ensure GPS is enabled and you are under clear sky.';
      } else if (rawMsg.includes('LOCATION_UNRELIABLE') || parsedCode === 'LOCATION_UNRELIABLE') {
        parsedCode = 'LOCATION_UNRELIABLE';
        rawMsg = 'GPS accuracy is too low. Please move to an area with clear skies and try again.';
      } else if (rawMsg.includes('QR_EXPIRED')) parsedCode = 'QR_EXPIRED';
      else if (rawMsg.includes('OUTSIDE_GEOFENCE')) parsedCode = 'OUTSIDE_GEOFENCE';
      else if (rawMsg.includes('SESSION_CLOSED')) parsedCode = 'SESSION_CLOSED';
      else if (rawMsg.includes('EVENT_LOCKED')) parsedCode = 'EVENT_LOCKED';
      else if (rawMsg.includes('MOCK_LOCATION_REJECTED')) parsedCode = 'MOCK_LOCATION_REJECTED';
      else if (rawMsg.includes('ALREADY_RECORDED')) {
        console.log(`[Attendance][Error] Handling ALREADY_RECORDED special case`);
        parsedCode = 'ALREADY_RECORDED';
      }
      else if (rawMsg.includes('NOT_REGISTERED')) parsedCode = 'NOT_REGISTERED';
      else if (rawMsg.includes('WAITLISTED')) parsedCode = 'WAITLISTED';
      else if (rawMsg.includes('REGISTRATION_NOT_ELIGIBLE')) parsedCode = 'REGISTRATION_NOT_ELIGIBLE';
      else if (rawMsg.includes('ACADEMICALLY_INELIGIBLE')) parsedCode = 'ACADEMICALLY_INELIGIBLE';

      console.log(`[Attendance][Error] Parsed code: ${parsedCode}, Final message: ${rawMsg}`);
      
      setErrorCode(parsedCode);
      setErrorMessage(rawMsg);
      
      console.log(`[Attendance][Result] UI State: FAILURE`);
      setFlowState('FAILURE');
    } finally {
      isProcessingRef.current = false;
      locationCacheRef.current = null;
      locationPromiseRef.current = null;
    }
  };

  const handleResetScan = () => {
    isProcessingRef.current = false;
    pendingQrDataRef.current = null;
    setFlowState('SCANNING');
    prefetchLocation();
  };

  // Render Permission Branches & Flow States
  if (flowState === 'CAMERA_PERMISSION') {
    return (
      <CameraPermissionView
        onRequestPermission={async () => {
          const res = await requestCameraPermission();
          if (res.granted) {
            const locPerm = await Location.getForegroundPermissionsAsync();
            if (locPerm.granted) {
              setFlowState('SCANNING');
              prefetchLocation();
            } else {
              setFlowState('LOCATION_PERMISSION');
            }
          }
        }}
        onCancel={() => router.back()}
      />
    );
  }

  if (flowState === 'LOCATION_PERMISSION') {
    return (
      <LocationPermissionView
        onRequestPermission={async () => {
          const res = await Location.requestForegroundPermissionsAsync();
          if (res.granted) {
            if (pendingQrDataRef.current) {
              processAttendanceSubmission(pendingQrDataRef.current);
            } else {
              setFlowState('SCANNING');
              prefetchLocation();
            }
          }
        }}
        onCancel={() => router.back()}
      />
    );
  }

  if (flowState === 'VERIFYING') {
    return <AttendanceVerificationView statusText={verificationStatus} />;
  }

  if (flowState === 'SUCCESS') {
    return (
      <AttendanceSuccessView
        locationName={sessionDetails.locationName || ''}
        timeLogged={sessionDetails.timeLogged || ''}
        onReturnHome={() => router.replace('/(app)')}
      />
    );
  }

  if (flowState === 'FAILURE') {
    return (
      <AttendanceFailureView
        errorCode={errorCode}
        errorMessage={errorMessage}
        onRetryScan={handleResetScan}
        onReturnHome={() => router.replace('/(app)')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <CameraView
        style={[styles.cameraView, StyleSheet.absoluteFill]}
        facing="back"
        enableTorch={torchActive}
        onBarcodeScanned={isProcessingRef.current ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <ScannerOverlay
        onClose={() => router.back()}
        onToggleTorch={() => setTorchActive((prev) => !prev)}
        torchActive={torchActive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
