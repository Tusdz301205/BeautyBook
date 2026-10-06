import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';

import RootTabs, { RootTabParamList } from './RootTabs';
import OtpVerifyScreen from '../screens/OtpVerifyScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import { useAuth } from '../context/AuthContext';
import { mobileShell } from '../utils/operationSession';
import OperationsNavigator from '../operations/OperationsNavigator';
import UnsupportedWorkspace from '../operations/UnsupportedWorkspace';

export type AuthReturnTo = 'account' | 'previous';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Operations: undefined;
  UnsupportedWorkspace: undefined;
  OtpVerify: { contact: string };
  Login: { returnTo?: AuthReturnTo } | undefined;
  Register: { returnTo?: AuthReturnTo } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  VerifyEmail: { token?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStack() {
  const { user } = useAuth();
  const shell = mobileShell(user);
  return (
    <Stack.Navigator key={shell} screenOptions={{ headerShown: false }}>
      {shell === 'CUSTOMER' ? <Stack.Screen name="MainTabs" component={RootTabs} /> : shell === 'UNSUPPORTED' ? <Stack.Screen name="UnsupportedWorkspace" component={UnsupportedWorkspace} /> : <Stack.Screen name="Operations" component={OperationsNavigator} />}
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </Stack.Navigator>
  );
}
