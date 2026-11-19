import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCurrentCampusCoords } from '../../lib/locationService';

export default function ExpoHomeScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState('Tap to check City Campus GPS');

  useEffect(() => {
    getCurrentCampusCoords().then((res) => {
      if (res.granted && res.lat && res.lng) {
        setCoords({ lat: res.lat, lng: res.lng });
        setStatus('GPS Active');
      } else {
        setStatus('GPS unavailable — manual campus origin active');
      }
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>University of Dundee · City Campus</Text>
        <Text style={styles.title}>CampusPulse Dundee</Text>
        <Text style={styles.subtitle}>Your Campus. Your Community. Your University.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Navigation Status</Text>
        <Text style={styles.body}>{status}</Text>
        {coords && (
          <Text style={styles.mono}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            const res = await getCurrentCampusCoords();
            if (res.granted && res.lat && res.lng) {
              setCoords({ lat: res.lat, lng: res.lng });
              setStatus('GPS Refreshed');
            }
          }}
        >
          <Text style={styles.buttonText}>Refresh GPS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, backgroundColor: '#F8FAFC' },
  hero: { padding: 20, borderRadius: 20, backgroundColor: '#0B1B3B', gap: 6 },
  kicker: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#CBD5E1', fontSize: 14 },
  card: { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  body: { fontSize: 13, color: '#475569' },
  mono: { fontSize: 12, color: '#1D4ED8' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
