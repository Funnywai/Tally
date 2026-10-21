import { useRegisterSW } from 'virtual:pwa-register/react';
import { useState } from 'react';
import { isStandalone } from '../lib/standalone';
import { DownloadIcon, RefreshIcon, ShareIcon, WifiOffIcon, XIcon } from './Icons';

const INSTALL_DISMISSED_KEY = 'tally_install_dismissed_v1';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

function wasInstallDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [visible, setVisible] = useState(
    () => isIosSafari() && !isStandalone() && !wasInstallDismissed(),
  );

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Storage can be unavailable in private mode; the banner simply returns next launch.
      setVisible(false);
    }
  };

  return (
    <div className="banner banner--install" role="note">
      <ShareIcon size={18} className="banner__icon" />
      <p className="banner__text">
        <strong>加入主畫面</strong>
        <span>Safari 分享 → 加入主畫面，離線都用到。</span>
      </p>
      <button
        type="button"
        className="icon-button icon-button--small"
        aria-label="關閉安裝提示"
        onClick={dismiss}
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="banner banner--update" role="status">
      <DownloadIcon size={18} className="banner__icon" />
      <p className="banner__text">
        <strong>有新版本</strong>
        <span>更新後即可使用最新功能。</span>
      </p>
      <div className="banner__actions">
        <button
          type="button"
          className="button button--small button--primary"
          onClick={() => void updateServiceWorker(true)}
        >
          更新
        </button>
        <button
          type="button"
          className="button button--small button--ghost"
          onClick={() => setNeedRefresh(false)}
        >
          稍後
        </button>
      </div>
    </div>
  );
}

interface OfflineBannerProps {
  readonly offline: boolean;
  readonly onRetry?: (() => void) | undefined;
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) {
    return null;
  }
  return (
    <div className="banner banner--offline" role="status">
      <WifiOffIcon size={18} className="banner__icon" />
      <p className="banner__text">
        <strong>離線模式</strong>
        <span>記分仍可使用；小氣簿需要連線。</span>
      </p>
      {onRetry === undefined ? null : (
        <button type="button" className="button button--small button--ghost" onClick={onRetry}>
          <RefreshIcon size={16} />
          重試
        </button>
      )}
    </div>
  );
}
