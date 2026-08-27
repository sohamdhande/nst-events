import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../../src/infrastructure/api';
import { Platform } from 'react-native';

export default function ScanAttendanceScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  if (!cameraPermission) {
    return <View style={styles.container}><ActivityIndicator /></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestCameraPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);
    setStatusMessage('Acquiring location...');
    try {
      // 1. Verify QR Format
      if (!data.startsWith('v1:')) {
        throw new Error('Invalid QR code format.');
      }
      const parts = data.split(':');
      if (parts.length !== 3) {
        throw new Error('Malformed QR code.');
      }
      const sessionId = parts[1];

      // 2. Request Location
      let { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        throw new Error('Location permission is required for attendance.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setStatusMessage('Verifying attendance...');

      // 3. Submit to backend
      const payload = {
        session_id: sessionId,
        totp_token: data,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        device_id: Platform.OS + '-' + (Platform.Version || 'unknown'),
        device_os: Platform.OS,
        gps_accuracy: location.coords.accuracy || 0,
        mock_location_detected: location.mocked || false,
        app_version: '1.0.0', // Standardize app version for now
      };

      const result = await apiClient('/v1/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert(
        'Success',
        'Attendance recorded successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      let title = 'Attendance Failed';
      let msg = err.message || 'An error occurred';
      
      // Map semantic errors
      if (msg.includes('QR_EXPIRED')) msg = 'This attendance QR has expired. Scan the current QR.';
      else if (msg.includes('OUTSIDE_GEOFENCE')) msg = 'You are outside the attendance area.';
      else if (msg.includes('SESSION_CLOSED')) msg = 'Attendance session is closed.';
      else if (msg.includes('MOCK_LOCATION_REJECTED')) msg = 'Mock location is not allowed.';
      else if (msg.includes('ACADEMICALLY_INELIGIBLE')) msg = 'Your academic batch is not eligible for this event.';
      else if (msg.includes('ACADEMIC_PROFILE_MISSING')) msg = 'Your academic profile is not available. Please contact the administrator.';
      else if (msg.includes('WAITLISTED')) msg = 'You are currently waitlisted for this event.';
      else if (msg.includes('REGISTRATION_NOT_ELIGIBLE')) msg = 'Your registration status does not permit attendance.';
      else if (msg.includes('NOT_REGISTERED')) msg = 'You are not registered for this event.';

      Alert.alert(title, msg, [
        { text: 'Scan Again', onPress: () => { setScanned(false); setLoading(false); setStatusMessage(''); } }
      ]);
    } finally {
      if (scanned) {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{statusMessage}</Text>
        </View>
      ) : (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
      )}
      {!loading && (
        <View style={styles.overlay}>
          <Text style={styles.scanText}>Scan Attendance QR Code</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: 'white',
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 16,
  },
});
