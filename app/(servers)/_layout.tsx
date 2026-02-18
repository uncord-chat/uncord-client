import { Stack } from "expo-router";

export default function ServersLayout(): React.ReactElement {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-server" />
    </Stack>
  );
}
