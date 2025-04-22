import { Game } from './Game'; // Import the main Game class

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Attempt to find the canvas element
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

  if (!canvas) {
    // Handle error if canvas isn't found
    console.error("Canvas element with id 'renderCanvas' not found!");
    showErrorMessage("Fatal Error: Render canvas not found in HTML.");
    return; // Stop execution if canvas is missing
  }

  // Optional: Show some loading indicator before starting the game
  const loadingDiv = document.getElementById('loadingIndicator'); // Assuming you have <div id="loadingIndicator">Loading...</div>
  if (loadingDiv) {
      loadingDiv.style.display = 'block';
  }

  try {
    // Create an instance of the Game, passing the canvas
    const game = new Game(canvas, () => {
      // Hide loading indicator when game is initialized
      const loadingDiv = document.getElementById('loadingIndicator');
      if (loadingDiv) {
        loadingDiv.style.display = 'none';
      }
      // Make sure canvas is visible
      if (canvas) {
        canvas.style.display = 'block';
      }
    });

    console.log('Game instance created. Initialization started...');

    // If you add an async method to Game like 'await game.fullyInitialized()'
    // you could hide the loading indicator here after it resolves.
    // For now, we'll assume the Game class handles hiding it internally or
    // it's acceptable for it to disappear once rendering starts.
    // Example (if Game had such a method):
    // game.fullyInitialized().then(() => {
    //    if (loadingDiv) loadingDiv.style.display = 'none';
    // });


  } catch (error) {
    // Catch errors during game instantiation (though most async errors happen inside Game.initialize)
    console.error('Failed to instantiate game:', error);
    showErrorMessage('Error setting up the game: ' + (error instanceof Error ? error.message : String(error)));
     if (loadingDiv) {
      loadingDiv.style.display = 'none'; // Hide loading on error too
    }
  }
});

// Helper function to display errors on screen (optional but helpful)
function showErrorMessage(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'gameError';
  // Style the error message appropriately (position, color, etc.)
  errorDiv.style.position = 'absolute';
  errorDiv.style.top = '10px';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translateX(-50%)';
  errorDiv.style.padding = '10px';
  errorDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
  errorDiv.style.color = 'white';
  errorDiv.style.border = '1px solid darkred';
  errorDiv.style.borderRadius = '5px';
  errorDiv.style.zIndex = '1001';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
}