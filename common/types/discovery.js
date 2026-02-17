/**
 * Discovery Types
 * Shared types for discovery and trending features
 */
/**
 * WebSocket events for discovery
 */
export var DiscoveryEvent;
(function (DiscoveryEvent) {
    // Trending updates
    DiscoveryEvent["TRENDING_UPDATED"] = "trending:updated";
    DiscoveryEvent["TRENDING_CATEGORY_UPDATED"] = "trending:category:updated";
    // Live now updates
    DiscoveryEvent["LIVE_NOW_UPDATED"] = "live-now:updated";
    // Room updates
    DiscoveryEvent["ROOM_VIEWER_COUNT_CHANGED"] = "room:viewer-count:changed";
    DiscoveryEvent["ROOM_STATUS_CHANGED"] = "room:status:changed";
    DiscoveryEvent["ROOM_METRICS_UPDATED"] = "room:metrics:updated";
    // Category updates
    DiscoveryEvent["CATEGORY_UPDATED"] = "category:updated";
})(DiscoveryEvent || (DiscoveryEvent = {}));
//# sourceMappingURL=discovery.js.map