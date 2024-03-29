self.importScripts('https://cdn.jsdelivr.net/npm/lodash@4.17.4/lodash.min.js')
self.importScripts('geneticSolver.js')

self.addEventListener('message', function(e) {
  // Any message from the host page starts a new computation
  const {groups, ofSize, forRounds, forbiddenPairs, discouragedGroups, generations, mutations, descendants} = e.data
  console.log("Groups: " + groups);
  console.log("Size: " + ofSize);
  console.log("Rounds: " + forRounds);
  console.log("Generations: " + generations);
  console.log("Mutations: " + mutations);
  console.log("Descendants: " + descendants);
  // Compute results and send them back to the host page
  geneticSolver(groups, ofSize, forRounds, forbiddenPairs, discouragedGroups, (results) => {
    self.postMessage(results)
  }, generations, mutations, descendants)
}, false)
