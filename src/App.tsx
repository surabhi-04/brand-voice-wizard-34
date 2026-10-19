import BrandVoiceStudio from "./components/studio/BrandVoiceStudio";
import { AuthProvider } from "./lib/auth-context";

export default function App() {
  return (
    <AuthProvider>
      <BrandVoiceStudio />
    </AuthProvider>
  );
}
