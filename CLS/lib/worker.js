/**
 * Import external scripts into worker
 */
self.importScripts('https://cdn.jsdelivr.net/npm/lodash@4.17.4/lodash.min.js');
self.importScripts('geneticSolver.js');

/**
 * Event listener for messages from the host page
 */
self.addEventListener('message', function(e) {
  // Start a new computation when a message is received from the host page
  const {groups, ofSize, forRounds, forbiddenPairs, discouragedGroups, generations, mutations, descendants} = e.data;
  console.log("Groups: " + groups);
  console.log("Size: " + ofSize);
  console.log("Rounds: " + forRounds);
  console.log("Generations: " + generations);
  console.log("Mutations: " + mutations);
  console.log("Descendants: " + descendants);
  // Call geneticSolver function with the provided parameters and callback
  geneticSolver(groups, ofSize, forRounds, forbiddenPairs, discouragedGroups, (results) => {
    self.postMessage(results);
  }, generations, mutations, descendants);
}, false);
