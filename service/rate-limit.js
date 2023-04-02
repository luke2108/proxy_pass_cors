'use strict';
module.exports = function createRateLimitChecker(CORSANYWHERE_RATELIMIT) {
  var rateLimitConfig = /^(\d+) (\d+)(?:\s*$|\s+(.+)$)/.exec(CORSANYWHERE_RATELIMIT);
  if (!rateLimitConfig) {
    // No rate limit by default.
    return function checkRateLimit() {};
  }
  var maxRequestsPerPeriod = parseInt(rateLimitConfig[1]);
  var periodInMinutes = parseInt(rateLimitConfig[2]);
  var unlimitedPattern = rateLimitConfig[3]; // Will become a RegExp or void.
  if (unlimitedPattern) {
    var unlimitedPatternParts = [];
    unlimitedPattern.trim().split(/\s+/).forEach(function(unlimitedHost, i) {
      var startsWithSlash = unlimitedHost.charAt(0) === '/';
      var endsWithSlash = unlimitedHost.slice(-1) === '/';
      if (startsWithSlash || endsWithSlash) {
        if (unlimitedHost.length === 1 || !startsWithSlash || !endsWithSlash) {
          throw new Error('Invalid CORSANYWHERE_RATELIMIT. Regex at index ' + i +
              ' must start and end with a slash ("/").');
        }
        unlimitedHost = unlimitedHost.slice(1, -1);
        // Throws if the pattern is invalid.
        new RegExp(unlimitedHost);
      } else {
        // Just escape RegExp characters even though they cannot appear in a host name.
        // The only actual important escape is the dot.
        unlimitedHost = unlimitedHost.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
      }
      unlimitedPatternParts.push(unlimitedHost);
    });
    unlimitedPattern = new RegExp('^(?:' + unlimitedPatternParts.join('|') + ')$', 'i');
  }

  var accessedHosts = Object.create(null);
  setInterval(function() {
    accessedHosts = Object.create(null);
  }, periodInMinutes * 60000);

  var rateLimitMessage = 'The number of requests is limited to ' + maxRequestsPerPeriod +
    (periodInMinutes === 1 ? ' per minute' : ' per ' + periodInMinutes + ' minutes') + '. ' +
    'Please self-host CORS Anywhere if you need more quota. ' +
    'See https://github.com/Rob--W/cors-anywhere#demo-server';

  return function checkRateLimit(origin) {
    var host = origin.replace(/^[\w\-]+:\/\//i, '');
    if (unlimitedPattern && unlimitedPattern.test(host)) {
      return;
    }
    var count = accessedHosts[host] || 0;
    ++count;
    if (count > maxRequestsPerPeriod) {
      return rateLimitMessage;
    }
    accessedHosts[host] = count;
  };
};
