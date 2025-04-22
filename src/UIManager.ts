import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class UIManager {
    private scene: BABYLON.Scene;
    private advancedTexture: GUI.AdvancedDynamicTexture;
    
    // Core UI containers for organization
    private topContainer: GUI.StackPanel;
    private bottomContainer: GUI.StackPanel;
    private centerContainer: GUI.StackPanel;
    
    // UI Elements
    private levelInfo: GUI.TextBlock;
    private controlsInfo: GUI.TextBlock;
    private interactionPrompt: GUI.TextBlock;
    private moveCounter: GUI.TextBlock;
    private solvedIndicator: GUI.Image;
    private feedbackText: GUI.TextBlock;
    private puzzleInfo: GUI.TextBlock;
    private helpButton: GUI.Button;
    
    // Popup elements
    private popupContainer: GUI.Rectangle;
    private popupText: GUI.TextBlock;
    private popupCloseButton: GUI.Button;
    
    // Help popup elements
    private helpPopupContainer: GUI.Rectangle;
    private helpPopupTitle: GUI.TextBlock;
    private helpPopupExampleContainer: GUI.Rectangle;
    private helpPopupCloseButton: GUI.Button;
    private helpPopupModalBackground: GUI.Rectangle;
    
    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("gameUI");
        
        // Setup UI containers and elements
        this.setupContainers();
        this.setupUI();
        this.setupPopup();
        this.setupHelpButton();
        this.setupHelpPopup();
        
        // Hide popups by default
        this.hidePopup();
        this.hideHelpPopup();
    }
    
    private setupContainers(): void {
        // Top container (level info, move counter)
        this.topContainer = new GUI.StackPanel("topContainer");
        this.topContainer.isVertical = true;
        this.topContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.topContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.topContainer.paddingTop = "20px";
        this.topContainer.width = "100%";
        this.advancedTexture.addControl(this.topContainer);
        
        // Bottom container (controls info)
        this.bottomContainer = new GUI.StackPanel("bottomContainer");
        this.bottomContainer.isVertical = true;
        this.bottomContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.bottomContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.bottomContainer.paddingLeft = "20px";
        this.bottomContainer.paddingBottom = "20px";
        this.advancedTexture.addControl(this.bottomContainer);
        
        // Center container (interaction prompts, feedback)
        this.centerContainer = new GUI.StackPanel("centerContainer");
        this.centerContainer.isVertical = true;
        this.centerContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.centerContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.centerContainer.paddingBottom = "100px";
        this.advancedTexture.addControl(this.centerContainer);
    }
    
    private setupUI(): void {
        // Level Info (top-center)
        this.levelInfo = new GUI.TextBlock("levelInfo");
        this.levelInfo.text = "Level: 1/5";
        this.levelInfo.color = "white";
        this.levelInfo.fontSize = 24;
        this.levelInfo.height = "40px";
        this.topContainer.addControl(this.levelInfo);
        
        // Puzzle Info (top-center, below level info)
        this.puzzleInfo = new GUI.TextBlock("puzzleInfo");
        this.puzzleInfo.text = "";
        this.puzzleInfo.color = "white";
        this.puzzleInfo.fontSize = 18;
        this.puzzleInfo.height = "30px";
        this.topContainer.addControl(this.puzzleInfo);
        
        // Add help button (?) at top-right corner
        this.helpButton = GUI.Button.CreateSimpleButton("helpButton", "?");
        this.helpButton.width = "50px";
        this.helpButton.height = "50px";
        this.helpButton.cornerRadius = 20;
        this.helpButton.color = "white";
        this.helpButton.background = "#3E92CC";
        this.helpButton.fontSize = 24;
        this.helpButton.fontWeight = "bold";
        this.helpButton.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.helpButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.helpButton.paddingTop = "20px";
        this.helpButton.paddingRight = "20px";
        
        // Add hover effect
        this.helpButton.onPointerEnterObservable.add(() => {
            this.helpButton.background = "#5DADE2";
        });
        this.helpButton.onPointerOutObservable.add(() => {
            this.helpButton.background = "#3E92CC";
        });
        
        // Add click event to show help popup
        this.helpButton.onPointerClickObservable.add(() => {
            this.showHelpPopup();
        });
        
        this.advancedTexture.addControl(this.helpButton);
        
        // Controls Info (bottom-left)
        this.controlsInfo = new GUI.TextBlock("controlsInfo");
        this.controlsInfo.text = "WASD: Move\nE: Interact\nR: Remove Queen\nM: Mark Cell\nH: Help";
        this.controlsInfo.color = "white";
        this.controlsInfo.fontSize = 18;
        this.bottomContainer.addControl(this.controlsInfo);
        
        // Interaction Prompt (center-bottom)
        this.interactionPrompt = new GUI.TextBlock("interactionPrompt");
        this.interactionPrompt.text = "";
        this.interactionPrompt.color = "white";
        this.interactionPrompt.fontSize = 24;
        this.interactionPrompt.height = "40px";
        this.centerContainer.addControl(this.interactionPrompt);
        
        // Feedback Text (below interaction prompt)
        this.feedbackText = new GUI.TextBlock("feedbackText");
        this.feedbackText.text = "";
        this.feedbackText.color = "white";
        this.feedbackText.fontSize = 20;
        this.feedbackText.height = "30px";
        this.centerContainer.addControl(this.feedbackText);
        
        // Move Counter
        this.moveCounter = new GUI.TextBlock("moveCounter");
        this.moveCounter.text = "Moves: 0";
        this.moveCounter.color = "white";
        this.moveCounter.fontSize = 18;
        this.moveCounter.height = "30px";
        this.topContainer.addControl(this.moveCounter);
    }
    
    private setupPopup(): void {
        // Create popup container
        this.popupContainer = new GUI.Rectangle("popupContainer");
        this.popupContainer.width = "600px";
        this.popupContainer.height = "700px";
        this.popupContainer.cornerRadius = 10;
        this.popupContainer.color = "white";
        this.popupContainer.thickness = 2;
        this.popupContainer.background = "rgba(0, 0, 0, 0.8)";
        this.advancedTexture.addControl(this.popupContainer);
        
        // Add popup text
        this.popupText = new GUI.TextBlock("popupText");
        this.popupText.text = "";
        this.popupText.color = "white";
        this.popupText.fontSize = 20;
        this.popupText.textWrapping = true;
        this.popupText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.popupText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.popupText.paddingTop = "40px";
        this.popupText.paddingLeft = "20px";
        this.popupText.paddingRight = "20px";
        this.popupContainer.addControl(this.popupText);
        
        // Add close button
        this.popupCloseButton = GUI.Button.CreateSimpleButton("closeButton", "Close");
        this.popupCloseButton.width = "150px";
        this.popupCloseButton.height = "40px";
        this.popupCloseButton.color = "white";
        this.popupCloseButton.cornerRadius = 5;
        this.popupCloseButton.background = "#4CAF50";
        this.popupCloseButton.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.popupCloseButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.popupCloseButton.paddingBottom = "20px";
        this.popupContainer.addControl(this.popupCloseButton);
        
        // Add click event to close button
        this.popupCloseButton.onPointerClickObservable.add(() => {
            this.hidePopup();
        });
    }
    
    private setupHelpButton(): void {
        // Help button setup is now included in setupUI method
    }
    
    private setupHelpPopup(): void {
        // Create a modal background to block input to the game
        const modalBackground = new GUI.Rectangle("modalBackground");
        modalBackground.width = "100%";
        modalBackground.height = "100%";
        modalBackground.color = "transparent";
        modalBackground.thickness = 0;
        modalBackground.background = "rgba(0, 0, 0, 0.5)";
        modalBackground.isPointerBlocker = true;
        modalBackground.zIndex = 10;
        this.advancedTexture.addControl(modalBackground);
        
        // Create help popup container
        this.helpPopupContainer = new GUI.Rectangle("helpPopupContainer");
        this.helpPopupContainer.width = "800px";
        this.helpPopupContainer.height = "600px";
        this.helpPopupContainer.cornerRadius = 10;
        this.helpPopupContainer.color = "white";
        this.helpPopupContainer.thickness = 2;
        this.helpPopupContainer.background = "rgba(0, 0, 0, 0.9)";
        this.helpPopupContainer.isPointerBlocker = true;
        this.helpPopupContainer.zIndex = 11;
        modalBackground.addControl(this.helpPopupContainer);
        
        // Create a grid layout to organize content including title
        const grid = new GUI.Grid("helpGrid");
        grid.width = "100%";
        grid.height = "100%";
        grid.zIndex = 12;
        
        // Define rows and columns
        grid.addRowDefinition(0.1); // For title
        grid.addRowDefinition(0.8); // For content
        grid.addRowDefinition(0.1); // For button
        grid.addColumnDefinition(1);
        
        this.helpPopupContainer.addControl(grid);
        
        // Add title - now positioned in its own row in the grid
        this.helpPopupTitle = new GUI.TextBlock("helpTitle");
        this.helpPopupTitle.text = "Game Rules & Example";
        this.helpPopupTitle.color = "white";
        this.helpPopupTitle.fontSize = 28;
        this.helpPopupTitle.fontWeight = "bold";
        this.helpPopupTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.helpPopupTitle.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.helpPopupTitle.zIndex = 13;
        grid.addControl(this.helpPopupTitle, 0, 0);
        
        // Create a sub-grid for content
        const contentGrid = new GUI.Grid("contentGrid");
        contentGrid.width = "100%";
        contentGrid.height = "100%";
        contentGrid.paddingLeft = "20px";
        contentGrid.paddingRight = "20px";
        contentGrid.zIndex = 12;
        
        // Define content grid's rows and columns
        contentGrid.addRowDefinition(1);
        contentGrid.addColumnDefinition(0.6);
        contentGrid.addColumnDefinition(0.4);
        
        grid.addControl(contentGrid, 1, 0);
        
        // Create a scroll viewer for the rules content
        const scrollViewer = new GUI.ScrollViewer("helpScrollViewer");
        scrollViewer.width = "100%";
        scrollViewer.height = "100%";
        scrollViewer.thickness = 0;
        scrollViewer.barSize = 15;
        scrollViewer.barColor = "#888888";
        scrollViewer.wheelPrecision = 10;
        scrollViewer.isPointerBlocker = true;
        contentGrid.addControl(scrollViewer, 0, 0);
        
        // Create and add the content to the scroll viewer
        const contentPanel = this.createHelpContent();
        scrollViewer.addControl(contentPanel);
        
        // Add example container to the right column
        const exampleContainer = new GUI.Rectangle("exampleContainer");
        exampleContainer.width = "90%";
        exampleContainer.height = "80%";
        exampleContainer.color = "white";
        exampleContainer.thickness = 1;
        exampleContainer.background = "rgba(50, 50, 50, 0.5)";
        exampleContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        contentGrid.addControl(exampleContainer, 0, 1);
        
        // Add grid example
        this.createGridExample(exampleContainer);
        
        // Add example caption
        const exampleCaption = new GUI.TextBlock("exampleCaption");
        exampleCaption.text = "Example: A valid queen placement for a 4x4 grid with 4 regions";
        exampleCaption.color = "#CCCCCC";
        exampleCaption.fontSize = 16;
        exampleCaption.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        exampleCaption.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        exampleCaption.paddingBottom = "5px";
        exampleCaption.height = "50px";
        contentGrid.addControl(exampleCaption, 0, 1);
        
        // Add close button
        this.helpPopupCloseButton = GUI.Button.CreateSimpleButton("helpCloseButton", "Got it!");
        this.helpPopupCloseButton.width = "150px";
        this.helpPopupCloseButton.height = "40px";
        this.helpPopupCloseButton.color = "white";
        this.helpPopupCloseButton.cornerRadius = 5;
        this.helpPopupCloseButton.background = "#4CAF50";
        this.helpPopupCloseButton.zIndex = 12;
        grid.addControl(this.helpPopupCloseButton, 2, 0);
        
        // Store the modal background for when we need to hide it
        this.helpPopupModalBackground = modalBackground;
        
        // Add click event to close button
        this.helpPopupCloseButton.onPointerClickObservable.add(() => {
            this.hideHelpPopup();
        });
        
        // Store the example container for later reference
        this.helpPopupExampleContainer = exampleContainer;
        
        // Hide the popup by default
        this.hideHelpPopup();
    }
    
    // Create a structured help content with proper formatting
    private createHelpContent(): GUI.StackPanel {
        // Create a container for all the help content
        const contentPanel = new GUI.StackPanel("helpContentPanel");
        contentPanel.width = "100%";
        contentPanel.spacing = 10;
        
        // Title
        const titleText = new GUI.TextBlock("helpTitleText");
        titleText.text = "HOW TO PLAY THE QUEEN PUZZLE GAME";
        titleText.color = "#FFD700"; // Gold color for title
        titleText.fontSize = 22;
        titleText.fontWeight = "bold";
        titleText.height = "35px";
        titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        contentPanel.addControl(titleText);
        
        // Add some spacing
        const spacer = new GUI.Rectangle("spacer");
        spacer.width = "100%";
        spacer.height = "10px";
        spacer.color = "transparent";
        spacer.thickness = 0;
        contentPanel.addControl(spacer);
        
        // 1. OBJECTIVE section
        const objectiveTitle = new GUI.TextBlock("objectiveTitle");
        objectiveTitle.text = "1. OBJECTIVE:";
        objectiveTitle.color = "#4CAF50"; // Green
        objectiveTitle.fontSize = 20;
        objectiveTitle.fontWeight = "bold";
        objectiveTitle.height = "30px";
        contentPanel.addControl(objectiveTitle);
        
        const objectiveText = new GUI.TextBlock("objectiveText");
        objectiveText.text = "Place queens on each colored region so that no queen threatens another queen.";
        objectiveText.color = "white";
        objectiveText.fontSize = 18;
        objectiveText.textWrapping = true;
        objectiveText.paddingLeft = "20px";
        objectiveText.height = "40px";
        contentPanel.addControl(objectiveText);
        
        // 2. QUEEN MOVEMENT RULES section
        const rulesTitle = new GUI.TextBlock("rulesTitle");
        rulesTitle.text = "2. QUEEN MOVEMENT RULES:";
        rulesTitle.color = "#4CAF50";
        rulesTitle.fontSize = 20;
        rulesTitle.fontWeight = "bold";
        rulesTitle.height = "30px";
        contentPanel.addControl(rulesTitle);
        
        const rulesText1 = new GUI.TextBlock("rulesText1");
        rulesText1.text = "• Queens can move horizontally, vertically, and diagonally (like in chess).";
        rulesText1.color = "white";
        rulesText1.fontSize = 18;
        rulesText1.textWrapping = true;
        rulesText1.paddingLeft = "20px";
        rulesText1.height = "40px";
        contentPanel.addControl(rulesText1);
        
        const rulesText2 = new GUI.TextBlock("rulesText2");
        rulesText2.text = "• A queen threatens any cell that shares its row, column, or diagonal.";
        rulesText2.color = "white";
        rulesText2.fontSize = 18;
        rulesText2.textWrapping = true;
        rulesText2.paddingLeft = "20px";
        rulesText2.height = "40px";
        contentPanel.addControl(rulesText2);
        
        // 3. PUZZLE RULES section
        const puzzleTitle = new GUI.TextBlock("puzzleTitle");
        puzzleTitle.text = "3. PUZZLE RULES:";
        puzzleTitle.color = "#4CAF50";
        puzzleTitle.fontSize = 20;
        puzzleTitle.fontWeight = "bold";
        puzzleTitle.height = "30px";
        contentPanel.addControl(puzzleTitle);
        
        const puzzleText1 = new GUI.TextBlock("puzzleText1");
        puzzleText1.text = "• Each colored region must contain exactly one queen.";
        puzzleText1.color = "white";
        puzzleText1.fontSize = 18;
        puzzleText1.textWrapping = true;
        puzzleText1.paddingLeft = "20px";
        puzzleText1.height = "30px";
        contentPanel.addControl(puzzleText1);
        
        const puzzleText2 = new GUI.TextBlock("puzzleText2");
        puzzleText2.text = "• No queen may threaten another queen.";
        puzzleText2.color = "white";
        puzzleText2.fontSize = 18;
        puzzleText2.textWrapping = true;
        puzzleText2.paddingLeft = "20px";
        puzzleText2.height = "30px";
        contentPanel.addControl(puzzleText2);
        
        const puzzleText3 = new GUI.TextBlock("puzzleText3");
        puzzleText3.text = "• You must place exactly one queen in each region to solve the puzzle.";
        puzzleText3.color = "white";
        puzzleText3.fontSize = 18;
        puzzleText3.textWrapping = true;
        puzzleText3.paddingLeft = "20px";
        puzzleText3.height = "40px";
        contentPanel.addControl(puzzleText3);
        
        // 4. CONTROLS section
        const controlsTitle = new GUI.TextBlock("controlsTitle");
        controlsTitle.text = "4. CONTROLS:";
        controlsTitle.color = "#4CAF50";
        controlsTitle.fontSize = 20;
        controlsTitle.fontWeight = "bold";
        controlsTitle.height = "30px";
        contentPanel.addControl(controlsTitle);
        
        // Create a container for controls to display them in a more compact way
        const controlsContainer = new GUI.Grid("controlsGrid");
        controlsContainer.addColumnDefinition(1);
        controlsContainer.addRowDefinition(0.2);
        controlsContainer.addRowDefinition(0.2);
        controlsContainer.addRowDefinition(0.2);
        controlsContainer.addRowDefinition(0.2);
        controlsContainer.addRowDefinition(0.2);
        controlsContainer.width = "100%";
        controlsContainer.height = "150px";
        controlsContainer.paddingLeft = "20px";
        contentPanel.addControl(controlsContainer);
        
        const controlsText1 = new GUI.TextBlock("controlsText1");
        controlsText1.text = "• Use WASD or arrow keys to move your character";
        controlsText1.color = "white";
        controlsText1.fontSize = 18;
        controlsText1.textWrapping = true;
        controlsContainer.addControl(controlsText1, 0, 0);
        
        const controlsText2 = new GUI.TextBlock("controlsText2");
        controlsText2.text = "• Press E to interact with altars and place queens";
        controlsText2.color = "white";
        controlsText2.fontSize = 18;
        controlsText2.textWrapping = true;
        controlsContainer.addControl(controlsText2, 1, 0);
        
        const controlsText3 = new GUI.TextBlock("controlsText3");
        controlsText3.text = "• Press R to remove a queen";
        controlsText3.color = "white";
        controlsText3.fontSize = 18;
        controlsText3.textWrapping = true;
        controlsContainer.addControl(controlsText3, 2, 0);
        
        const controlsText4 = new GUI.TextBlock("controlsText4");
        controlsText4.text = "• Press M to mark/unmark a cell for planning";
        controlsText4.color = "white";
        controlsText4.fontSize = 18;
        controlsText4.textWrapping = true;
        controlsContainer.addControl(controlsText4, 3, 0);
        
        const controlsText5 = new GUI.TextBlock("controlsText5");
        controlsText5.text = "• Press H for this help screen";
        controlsText5.color = "white";
        controlsText5.fontSize = 18;
        controlsText5.textWrapping = true;
        controlsContainer.addControl(controlsText5, 4, 0);
        
        return contentPanel;
    }
    
    // Create a simple grid example with queens
    private createGridExample(container: GUI.Rectangle): void {
        // Use the image from public/images instead of creating a grid programmatically
        const exampleImage = new GUI.Image("gridExampleImage", "/images/example.png");
        exampleImage.width = "400px";
        exampleImage.height = "250px";
        exampleImage.stretch = GUI.Image.STRETCH_UNIFORM;
        container.addControl(exampleImage);
    }
    
    // Show help popup
    public showHelpPopup(): void {
        if (this.helpPopupModalBackground) {
            this.helpPopupModalBackground.isVisible = true;
        }
    }
    
    // Hide help popup
    public hideHelpPopup(): void {
        if (this.helpPopupModalBackground) {
            this.helpPopupModalBackground.isVisible = false;
        }
    }
    
    // Update level information
    public updateLevelInfo(currentLevel: number, totalLevels: number): void {
        this.levelInfo.text = `Level: ${currentLevel}/${totalLevels}`;
    }
    
    // Update move counter
    public updateMoveCounter(moves: number): void {
        this.moveCounter.text = `Moves: ${moves}`;
    }
    
    // Show interaction prompt (e.g., "Press E to interact")
    public showInteractionPrompt(text: string): void {
        this.interactionPrompt.text = text;
    }
    
    // Hide interaction prompt
    public hideInteractionPrompt(): void {
        this.interactionPrompt.text = "";
    }
    
    // Show feedback message with optional auto-hide
    public showFeedback(message: string, color: string = "white", autoHideMs: number = 3000): void {
        this.feedbackText.text = message;
        this.feedbackText.color = color;
        
        // Auto-hide if requested
        if (autoHideMs > 0) {
            setTimeout(() => {
                this.hideFeedback();
            }, autoHideMs);
        }
    }
    
    // Hide feedback message
    public hideFeedback(): void {
        this.feedbackText.text = "";
    }
    
    // Show success feedback
    public showSuccess(message: string, autoHideMs: number = 3000): void {
        this.showFeedback(message, "#4CAF50", autoHideMs); // Green color
    }
    
    // Show error feedback
    public showError(message: string, autoHideMs: number = 3000): void {
        this.showFeedback(message, "#F44336", autoHideMs); // Red color
    }
    
    // Show warning feedback
    public showWarning(message: string, autoHideMs: number = 3000): void {
        this.showFeedback(message, "#FF9800", autoHideMs); // Orange color
    }
    
    // Update puzzle info
    public updatePuzzleInfo(info: string): void {
        this.puzzleInfo.text = info;
    }
    
    // Show popup with message
    public showPopup(title: string, message: string, buttonText: string = "Close"): void {
        this.popupText.text = `${title}\n\n${message}`;
        this.popupCloseButton.textBlock.text = buttonText;
        this.popupContainer.isVisible = true;
    }
    
    // Hide popup
    public hidePopup(): void {
        this.popupContainer.isVisible = false;
    }
    
    // Show level completion popup
    public showLevelCompleted(level: number, moves: number): void {
        const title = `Level ${level} Completed!`;
        const message = `You solved the puzzle in ${moves} moves.\n\nContinue to the next challenge!`;
        this.showPopup(title, message, "Continue");
    }
    
    // Show game completed popup
    public showGameCompleted(totalMoves: number): void {
        const title = "Game Completed!";
        const message = `Congratulations! You've solved all puzzles with a total of ${totalMoves} moves.`;
        this.showPopup(title, message, "Play Again");
    }
    
    // Show tutorial popup
    public showTutorial(message: string): void {
        this.showPopup("How to Play", message, "Got it!");
    }
    
    // Flash element to draw attention
    public flashElement(element: GUI.Control, flashColor: string = "#FFEB3B", duration: number = 1000): void {
        const originalColor = (element as any).color || "white";
        
        // Flash animation
        let flashCount = 3;
        const flashInterval = duration / (flashCount * 2);
        
        const flash = () => {
            if (flashCount <= 0) {
                (element as any).color = originalColor;
                return;
            }
            
            (element as any).color = flashColor;
            
            setTimeout(() => {
                (element as any).color = originalColor;
                flashCount--;
                
                setTimeout(() => {
                    flash();
                }, flashInterval);
            }, flashInterval);
        };
        
        flash();
    }
} 