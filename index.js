// We begin by declaring and initializing some page-global variables.
//
// These are references to the inputs column and the outputs column,
// and an object to organize references to individual controls, so
// that working with the DOM is more readable later.
let controlsDiv, resultsDiv
let controls = {}
const isDebug = true; //Turn console messages to console on or off.
if (isDebug){console.log("Verbose Debugging is ON.");}
// Also references for the help text
let helpDivs, showHelpLink, hideHelpLink

// These variables hold the state of the input controls, which are
// also the parameters we will pass into the solver.
let groups = 0
let ofSize = 0
let forRounds = 0
let playerNames = []
let forbiddenPairs = Immutable.Set()
let discouragedGroups = Immutable.Set()

// Each time we kick off the solver we will mark the time, so that
// we can eaily report the time required to compute the solution.
let startTime

// This variable holds the last result returned by the solver,
let lastResults

// Next we launch a web worker which is responsible for the slow job
// of actually computing a solution.
// This gets the solver work out of the UI thread (this one) and
// keeps the interface feeling responsive while a solution is being
// computed.
const myWorker = new Worker('lib/worker.js');

// The init() function is called after the DOM is loaded. It prepares
// the application by setting up event handlers and an initial state
// and calling for an initial solution.
function init() {
  myWorker.addEventListener('message', onResults, false);

  const numGroups = document.getElementById('groupsSlider');
  const groupSize = document.getElementById('ofSizeSlider');
  const playerList = document.getElementById('playerNames');
  const maxNumPlayers = document.getElementById('maxOfPlayers');

  maxNumPlayers.innerHTML = numGroups.value * groupSize.value;  
  const text = playerList.value;
  const lines = text.split("\n");
  const count = lines.length;
  if (lines[lines.length - 1] == '') {
  document.getElementById('numOfPlayers').innerHTML = count - 1;
  } else {
    document.getElementById('numOfPlayers').innerHTML = count;
  }
  var remSpots = parseInt(maxNumPlayers.innerHTML) - parseInt(document.getElementById('numOfPlayers').innerHTML);
  playerComp(remSpots);
  numGroups.addEventListener('input', function(){
    const numGroups = document.getElementById('groupsSlider').value;
    const groupSize = document.getElementById('ofSizeSlider').value;
    document.getElementById('maxOfPlayers').innerHTML = numGroups * groupSize;
    var remSpots = parseInt(maxNumPlayers.innerHTML) - parseInt(document.getElementById('numOfPlayers').innerHTML);
    playerComp(remSpots);
  })
  groupSize.addEventListener('input', function(){
    const numGroups = document.getElementById('groupsSlider').value;
    const groupSize = document.getElementById('ofSizeSlider').value;
    document.getElementById('maxOfPlayers').innerHTML = numGroups * groupSize;
    var remSpots = parseInt(maxNumPlayers.innerHTML) - parseInt(document.getElementById('numOfPlayers').innerHTML);
    playerComp(remSpots);
  })

  playerList.addEventListener('input', function() {
    const text = playerList.value;
    const lines = text.split("\n");
    const count = lines.length;
    if (lines[lines.length - 1] == '') {
      document.getElementById('numOfPlayers').innerHTML = count - 1;
      } else {
        document.getElementById('numOfPlayers').innerHTML = count;
      }
      var remSpots = parseInt(maxNumPlayers.innerHTML) - parseInt(document.getElementById('numOfPlayers').innerHTML);
      playerComp(remSpots);
    if (isDebug){
          console.log("Player List Count: " + count);
    }
  })

  controlsDiv = document.getElementById('controls')
  resultsDiv = document.getElementById('results')
  helpDivs = document.querySelectorAll('.help-text')

  showHelpLink = document.getElementById("show-help-link")
  hideHelpLink = document.getElementById("hide-help-link")

  controls.generateButton = controlsDiv.querySelector('#generateButton')
  controls.groupsLabel = controlsDiv.querySelector('#groupsLabel')
  controls.groupsSlider = controlsDiv.querySelector('#groupsSlider')
  controls.ofSizeLabel = controlsDiv.querySelector('#ofSizeLabel')
  controls.ofSizeSlider = controlsDiv.querySelector('#ofSizeSlider')
  controls.forRoundsLabel = controlsDiv.querySelector('#forRoundsLabel')
  controls.forRoundsSlider = controlsDiv.querySelector('#forRoundsSlider')
  controls.playerNames = controlsDiv.querySelector('#playerNames')
  controls.forbiddenPairs = controlsDiv.querySelector('#forbiddenPairs')
  controls.discouragedGroups = controlsDiv.querySelector('#discouragedGroups')

  // User input controls
  controls.generateButton.onclick = generateResults;
  controls.groupsSlider.oninput = onSliderMoved
  controls.ofSizeSlider.oninput = onSliderMoved
  controls.forRoundsSlider.oninput = onSliderMoved
  controls.playerNames.onkeyup = onPlayerNamesKeyUp
  controls.playerNames.onchange = onPlayerNamesChanged
  controls.forbiddenPairs.onchange = onForbiddenPairsChanged
  controls.discouragedGroups.onchange = onDiscouragedGroupsChanged

  try {
    loadStateFromLocalStorage()
  } catch {
    console.info('Failed to load previous state');
  }

  playerNames = readPlayerNames()
  readConstraints(playerNames)
  onSliderMoved()

  if (lastResults) {
    renderResults()
  } else {
    generateResults()
  }
}

function playerComp(spotsRemaining){
  if (spotsRemaining >= 0) {
    document.getElementById('playerCountComparison').style.color = 'green';
    document.getElementById('errTooManyPlayers').style.visibility = 'hidden';
    console.log("at least 0 spots")
  } else {
    console.log("less than 0 spots")
    document.getElementById('playerCountComparison').style.color = 'red';
    document.getElementById('errTooManyPlayers').style.visibility = 'visible';
  }
  if (isDebug){
  console.log("There are " + spotsRemaining.toString() + " spots remaining.");
  }
}

function onResults(e) {
  lastResults = e.data
  renderResults()
  if (lastResults.done) {
    saveStateToLocalStorage()
    enableControls()
  }
}

function generateResults() {
  startTime = Date.now();
  lastResults = null;
  renderResults()
  disableControls()
  myWorker.postMessage({groups, ofSize, forRounds, forbiddenPairs: forbiddenPairs.toJS(), discouragedGroups: discouragedGroups.toJS()})
}

// Every time we finish computing results we save the solution and and the
// input parameters that produced it to local storage. Whenever the user
// returns to the page we restore the latest solution. This would be helpful
// to teachers that need an updated configuration for the same class.
function saveStateToLocalStorage() {
  localStorage.setItem('appState', JSON.stringify({
    groups,
    ofSize,
    forRounds,
    playerNames,
    forbiddenPairs: forbiddenPairs.toJS(),
    discouragedGroups: discouragedGroups.toJS(),
    lastResults
  }))
}

// When we load state on page load, we pull state from local storage and
// (mostly) write the state directly to the page controls. Then the normal
// initialization process will pick up the state from the controls.
// The one exception is that we load lastResults directly into the relevant
// variable, because it doesn't have a corresponding control on the page.
// This method will throw if a past state is not found in local storage or
// if we fail to deserialize it for some reason.
function loadStateFromLocalStorage() {
  const state = JSON.parse(localStorage.getItem('appState'))
  if (!state) throw new Error('Failed to load stored state')

  controls.groupsSlider.value = state.groups
  controls.ofSizeSlider.value = state.ofSize
  controls.forRoundsSlider.value = state.forRounds
  controls.playerNames.value = state.playerNames.join("\n")
  controls.forbiddenPairs.value = state.forbiddenPairs.map(x => x.map(i => state.playerNames[i]).join(",")).join("\n")
  controls.discouragedGroups.value = state.discouragedGroups.map(x => x.map(i => state.playerNames[i]).join(",")).join("\n")
  lastResults = state.lastResults 
}

function onSliderMoved() {
  groups = parseInt(controls.groupsSlider.value, 10)
  ofSize = parseInt(controls.ofSizeSlider.value, 10)
  forRounds = parseInt(controls.forRoundsSlider.value, 10)

  // Update labels
  controls.groupsLabel.textContent = groups
  controls.ofSizeLabel.textContent = ofSize
  controls.forRoundsLabel.textContent = forRounds
}

function disableControls() {
  controls.generateButton.disabled = true
  controls.groupsSlider.disabled = true
  controls.ofSizeSlider.disabled = true
  controls.forRoundsSlider.disabled = true
  controls.playerNames.disabled = true
  controls.forbiddenPairs.disabled = true
  controls.discouragedGroups.disabled = true
  
  // Show spinner
  controls.generateButton.innerHTML = '&nbsp;<span class="spinner"></span>'
}

function enableControls() {
  controls.generateButton.disabled = false
  controls.groupsSlider.disabled = false
  controls.ofSizeSlider.disabled = false
  controls.forRoundsSlider.disabled = false
  controls.playerNames.disabled = false
  controls.forbiddenPairs.disabled = false
  controls.discouragedGroups.disabled = false
  
  // Hide spinner
  controls.generateButton.innerHTML = 'Generate!'
}

function readPlayerNames() {
  return controls.playerNames.value
    .split('\n')
    .map(name => name.trim())
}

function onPlayerNamesKeyUp() {
  playerNames = readPlayerNames()
  renderResults()
}

function onPlayerNamesChanged() {
  playerNames = readPlayerNames()
  renderResults()
}

function onForbiddenPairsChanged() {
  forbiddenPairs = readGroupConstraintFromControl(controls.forbiddenPairs, playerNames)
}

function onDiscouragedGroupsChanged() {
  discouragedGroups = readGroupConstraintFromControl(controls.discouragedGroups, playerNames)
}

function showHelp() {
  resultsDiv.style.opacity = "0.4"
  showHelpLink.style.display = "none"
  hideHelpLink.style.display = "inline"
  for (const div of helpDivs) {
    div.style.display = 'block'
  }
}

function hideHelp() {
  resultsDiv.style.opacity = "1"
  showHelpLink.style.display = "inline"
  hideHelpLink.style.display = "none"
  for (const div of helpDivs) {
    div.style.display = 'none'
  }
}

// This function reads the forbidden groups and discouraged groups
// from the DOM and writes the global state variables accordingly,
// using playerIndices instead of names.
function readConstraints(playerNames) {
  forbiddenPairs = readGroupConstraintFromControl(controls.forbiddenPairs, playerNames)
  discouragedGroups = readGroupConstraintFromControl(controls.discouragedGroups, playerNames)
}

/**
 * Given a textarea containing multiple comma-separated lists of player names,
 * where the lists are separated by newlines, returns a set of sets of player
 * ids suitable for passing as a contstraint to the solver.
 * Names not found in the provided playerNames list are ignored.
 * @param {HTMLTextAreaElement} control
 * @param {Array<string>} playerNames 
 * @returns {Immutable.Set<Immutable.Set<number>>}
 */
function readGroupConstraintFromControl(control, playerNames) {
  return control.value
    .split('\n')
    .map(playerNameList =>
      playerNameList
        .split(',')
        .map(name => name.trim()))
    // Drop lines that aren't groups
    .filter(group => group.length >= 2)
    // Convert player names to indices
    .reduce((memo, group) => {
      let groupSet = Immutable.Set()
      for (const playerName of group) {
        for (const index of indicesOf(playerName, playerNames)) {
          groupSet = groupSet.add(index)
        }
      }
      // Ignore single-member groups, since they don't make useful constraints.
      return groupSet.size >= 2 ? memo.add(groupSet) : memo;
    }, Immutable.Set())
}

function indicesOf(needle, haystack) {
  const indices = []
  let nextIndex = -1
  do {
    nextIndex = haystack.indexOf(needle, nextIndex + 1)
    if (nextIndex > -1) indices.push(nextIndex)
  } while (nextIndex > -1)
  return indices
}

function playerName(i) {
  return playerNames[i] ? playerNames[i] : `Player ${i+1}`
}

function downloadCsv() {
  // Pivot results into a table that's easier to work with
  const roundNames = lastResults.rounds.map((_, i) => `Round ${i + 1}`)
  const playerCount = lastResults.rounds[0].length * lastResults.rounds[0][0].length
  
  // Stub out a row for each player
  const players = []
  for (let i = 0; i < playerCount; i++) {
    players.push([playerName(i)])
  }
  
  // Fill in assigned groups
  lastResults.rounds.forEach((round) => {
    round.forEach((group, j) => {
      group.forEach(playerIndex => {
        players[playerIndex].push(`Group ${j + 1}`)
      })
    })
  })
  
  // Build table
  const rows = [
    ['', ...roundNames],
    ...players
  ]
  // For debugging: console.table(rows);
  
  let csvContent = "data:text/csv;charset=utf-8," 
    + rows.map(e => e.join(",")).join("\n");
  
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", "Commander_League_Schedule.csv")
  document.body.appendChild(link)
  link.click()
}

function renderResults() {
  resultsDiv.innerHTML = ''
  if (lastResults) {
    lastResults.rounds.forEach((round, roundIndex) => {
      if (isDebug){
        if (oldResults != lastResults.roundScores){
        console.log("Render Results (Round " + roundIndex + " Scores): " + lastResults.roundScores);
        oldResults = lastResults.roundScores;
        }
      }
      const roundDiv = document.createElement('div')
      roundDiv.classList.add('round')
  
      const header = document.createElement('h1')
      header.textContent = `Round ${roundIndex+1}`
      const conflictScore = document.createElement('div')
      conflictScore.classList.add('conflictScore')
      conflictScore.textContent = `Conflict score: ${lastResults.roundScores[roundIndex]}`
      header.appendChild(conflictScore)
  
      const groups = document.createElement('div')
      groups.classList.add('groups')
  
      round.forEach((group, groupIndex) => {
        const groupDiv = document.createElement('div')
        groupDiv.classList.add('group')
        const groupName = document.createElement('h2')
        groupName.textContent = `Group ${groupIndex + 1}`
        groupDiv.appendChild(groupName)
  
        const members = document.createElement('ul')
        group.sort((a, b) => parseInt(a) < parseInt(b) ? -1 : 1).forEach(personNumber => {
          const member = document.createElement('li')
          member.textContent = playerName(personNumber)
          members.appendChild(member)
        })
        groupDiv.appendChild(members)
  
        groups.appendChild(groupDiv)
      })
  
      roundDiv.appendChild(header)
      roundDiv.appendChild(groups)
      resultsDiv.appendChild(roundDiv)
    })
    
    if (lastResults.done) {
      // Summary div - total time and CSV download
      const summaryDiv = document.createElement('div')
      summaryDiv.classList.add('resultsSummary');
      summaryDiv.style.borderTop = 'solid #aaaaaa thin'
      summaryDiv.style.padding = '7px 0'

      const csvButton = document.createElement('button')
      csvButton.type = 'button'
      csvButton.appendChild(document.createTextNode('Download CSV'))
      csvButton.onclick = downloadCsv

      const printButton = document.createElement('button')
      printButton.type = 'button'
      printButton.appendChild(document.createTextNode('Print Results'))
      printButton.onclick = () => window.print()
      
      const elapsedTime = document.createElement('span')
      elapsedTime.style.fontStyle = 'italic'
      elapsedTime.style.fontSize = 'smaller'
      if (startTime) {
        const elapsedSecs = Math.round((Date.now() - startTime) / 100) / 10
        elapsedTime.textContent = `Computed in ${elapsedSecs} seconds.`
      } else {
        elapsedTime.textContent = `Loaded from local storage.`
      }
      
      summaryDiv.appendChild(elapsedTime)
      summaryDiv.appendChild(csvButton)
      summaryDiv.appendChild(printButton)
      resultsDiv.appendChild(summaryDiv)
    } else {
      resultsDiv.appendChild(document.createTextNode('Thinking...'));
    }
  }
}

document.addEventListener('DOMContentLoaded', init)