import React from 'react';
import { View, ScrollView } from 'react-native';
import { EmptyState } from '../../../../src/ui/primitives';

export default function TeamsScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50 p-4" accessibilityRole="scrollbar">
      <View style={{ paddingTop: 80 }}>
        <EmptyState 
          icon="💻" 
          title="Desktop Required" 
          message="Team management (creating, joining, and inviting) is only available on the desktop web application." 
        />
      </View>
    </ScrollView>
  );
}
