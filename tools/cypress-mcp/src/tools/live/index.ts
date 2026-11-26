import type { ToolDefinition } from "../../types.js";
import { liveLaunch, liveClose, liveResize, liveInstallBrowsers } from "./session.js";
import { liveNavigate, liveGoBack, liveReload } from "./navigate.js";
import { liveSnapshot, liveScreenshot } from "./snapshot.js";
import {
  liveClick,
  liveType,
  liveHover,
  livePressKey,
  liveFill,
  liveSelect,
} from "./interact.js";
import {
  livePickLocator,
  liveHighlight,
  liveHideHighlight,
  liveEvaluate,
  liveGetOuterHtml,
} from "./inspect.js";
import { liveWaitFor, liveConsoleMessages, liveNetworkRequests } from "./observe.js";
import { liveEnumerateLinks, liveDiscoverForms, liveDiscoverInteractive } from "./discover.js";

export const liveTools: ToolDefinition[] = [
  liveLaunch,
  liveClose,
  liveResize,
  liveInstallBrowsers,
  liveNavigate,
  liveGoBack,
  liveReload,
  liveSnapshot,
  liveScreenshot,
  liveClick,
  liveType,
  liveHover,
  livePressKey,
  liveFill,
  liveSelect,
  livePickLocator,
  liveHighlight,
  liveHideHighlight,
  liveEvaluate,
  liveGetOuterHtml,
  liveWaitFor,
  liveConsoleMessages,
  liveNetworkRequests,
  liveEnumerateLinks,
  liveDiscoverForms,
  liveDiscoverInteractive,
];
