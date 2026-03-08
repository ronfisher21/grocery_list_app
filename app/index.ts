import { I18nManager } from "react-native";
import { registerRootComponent } from "expo";

// Force RTL for Hebrew UI — must run before any component renders
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

import App from "./App";

registerRootComponent(App);
