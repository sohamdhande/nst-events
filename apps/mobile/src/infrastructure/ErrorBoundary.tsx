import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../ui/primitives';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 justify-center items-center p-6 bg-surface">
          <Text className="text-xl font-bold text-danger mb-4">Something went wrong</Text>
          <Text className="text-gray-600 text-center mb-6">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Button 
            title="Try Again" 
            onPress={() => this.setState({ hasError: false, error: null })} 
          />
        </View>
      );
    }

    return this.props.children;
  }
}
