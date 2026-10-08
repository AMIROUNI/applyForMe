const openPanelInTab = (): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
};

chrome.action.onClicked.addListener(openPanelInTab);

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});
