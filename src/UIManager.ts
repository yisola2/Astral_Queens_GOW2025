import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { AudioManager } from './AudioManager';

export class UIManager {
    private scene: BABYLON.Scene;
    private advancedTexture: GUI.AdvancedDynamicTexture;
    private audioManager: AudioManager | null = null;
    
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
    private muteButton: GUI.Button;
    private isMuted: boolean = false;
    
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
    
    // Interaction prompt container
    private interactionPromptContainer: GUI.Rectangle | null;
    
    private topRightPanel: GUI.StackPanel;
    
    constructor(scene: BABYLON.Scene, audioManager?: AudioManager) {
        this.scene = scene;
        this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("gameUI");
        if (audioManager) this.audioManager = audioManager;
        
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
        this.controlsInfo.text = "WASD: Move\nE: Interact\nR: Remove Queen\nSPACE: Mark Cell\nH: Help";
        this.controlsInfo.color = "white";
        this.controlsInfo.fontSize = 18;
        this.bottomContainer.addControl(this.controlsInfo);
        
        // Interaction Prompt (center-bottom)
        this.interactionPrompt = new GUI.TextBlock("interactionPrompt");
        this.interactionPrompt.text = "";
        this.interactionPrompt.color = "white";
        this.interactionPrompt.fontSize = 28;
        this.interactionPrompt.height = "50px";
        this.interactionPrompt.fontWeight = "bold";
        this.interactionPrompt.outlineWidth = 1;
        this.interactionPrompt.outlineColor = "black";
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
        this.popupContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.popupContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.popupContainer.zIndex = 1000;
        this.popupContainer.isVisible = true;
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
        grid.addRowDefinition(0.08); // For title (unchanged)
        grid.addRowDefinition(0.88); // For content (increased)
        grid.addRowDefinition(0.06); // For button (reduced)
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
        contentGrid.zIndex = 15;
        
        // Define content grid's rows and columns
        contentGrid.addRowDefinition(1);
        contentGrid.addColumnDefinition(0.5); // 70% for text
        contentGrid.addColumnDefinition(0.5); // 30% for image
        
        grid.addControl(contentGrid, 1, 0);
        
        // Create a scroll viewer for the rules content (left column)
        const scrollViewer = new GUI.ScrollViewer();
        scrollViewer.width = "100%";
        scrollViewer.height = "100%";
        scrollViewer.thickness = 0;
        scrollViewer.barSize = 15;
        scrollViewer.barColor = "#888888";
        scrollViewer.wheelPrecision = 10;
        scrollViewer.isPointerBlocker = true;
        scrollViewer.paddingLeft = "10px";
        scrollViewer.paddingRight = "10px";
        scrollViewer.paddingTop = "0px";
        scrollViewer.paddingBottom = "0px";

        // Single TextBlock for all help text
        const helpText =
            "HOW TO PLAY\n\n" +
            "GOAL:\n" +
            "Place exactly one queen in each row, column, and colored region.\n\n" +
            "RULES:\n" +
            "1. Each row, column, and colored region must have exactly one queen.\n" +
            "2. Queens cannot be placed in cells adjacent (horizontally, vertically, OR diagonally) to another queen. They cannot touch, even at corners.\n\n" +
            "CONTROLS:\n" +
            "• WASD / ZQSD: Move character\n" +
            "• Mouse or Arrow Keys: Look around\n" +
            "• E: Interact with altars / Place queen on highlighted cell\n" +
            "• R: Remove queen from highlighted cell\n" +
            "• SPACE: Mark/unmark highlighted cell (for planning)\n" +
            "• H: Show the help screen\n";
        const helpBlock = new GUI.TextBlock();
        helpBlock.text = helpText;
        helpBlock.color = "white";
        helpBlock.fontSize = 20;
        helpBlock.textWrapping = true;
        helpBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        helpBlock.lineSpacing = 4;
        helpBlock.height = "auto";
        helpBlock.resizeToFit = true;
        helpBlock.paddingLeft = "10px";
        helpBlock.paddingRight = "10px";
        helpBlock.paddingTop = "0px";
        helpBlock.paddingBottom = "10px";
        scrollViewer.addControl(helpBlock);
        contentGrid.addControl(scrollViewer, 0, 0);
        
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
        exampleCaption.text = "example: A valid queen placement";
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
    
    // Create a simple grid example with queens
    private createGridExample(container: GUI.Rectangle): void {
        // Use the image from public/images instead of creating a grid programmatically
        const exampleImage = new GUI.Image("gridExampleImage", "images/example.png");
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
        this.interactionPrompt.isVisible = true;
    }
    
    // Hide interaction prompt
    public hideInteractionPrompt(): void {
        this.interactionPrompt.text = "";
        this.interactionPrompt.isVisible = false;
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
    public showPopup(title: string, message: string, buttonText: string = "Start Game"): void {
        // Style the popup container
        this.popupContainer.width = "600px";
        this.popupContainer.height = "500px";
        this.popupContainer.cornerRadius = 18;
        this.popupContainer.color = "#FFD700";
        this.popupContainer.thickness = 5;
        this.popupContainer.background = "rgba(30, 30, 40, 0.97)";
        this.popupContainer.shadowBlur = 24;
        this.popupContainer.shadowOffsetX = 0;
        this.popupContainer.shadowOffsetY = 8;
        this.popupContainer.shadowColor = "#000000AA";
        this.popupContainer.paddingTop = "20px";
        this.popupContainer.paddingBottom = "20px";
        this.popupContainer.paddingLeft = "30px";
        this.popupContainer.paddingRight = "30px";
        this.popupContainer.zIndex = 1000;
        this.popupContainer.isVisible = true;

        // Remove all previous controls
        this.popupContainer.clearControls();

        // Create a single vertical stack panel that will contain everything
        const mainPanel = new GUI.StackPanel();
        mainPanel.width = "100%";
        mainPanel.height = "100%";
        mainPanel.isVertical = true;
        mainPanel.spacing = 20;
        this.popupContainer.addControl(mainPanel);

        // Title
        const titleBlock = new GUI.TextBlock();
        titleBlock.text = title;
        titleBlock.color = "#FFD700";
        titleBlock.fontSize = 38;
        titleBlock.fontWeight = "bold";
        titleBlock.height = "60px";
        titleBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainPanel.addControl(titleBlock);

        // Message (rich text) inside a scroll viewer
        const scrollViewer = new GUI.ScrollViewer();
        scrollViewer.width = "100%";
        scrollViewer.height = "300px"; // Fixed height for the scrollable area
        scrollViewer.thickness = 0;
        scrollViewer.barSize = 15;
        scrollViewer.barColor = "#888888";
        scrollViewer.wheelPrecision = 10;
        scrollViewer.isPointerBlocker = true;

        const messageBlock = new GUI.TextBlock();
        messageBlock.text = message;
        messageBlock.color = "white";
        messageBlock.fontSize = 20;
        messageBlock.textWrapping = true;
        messageBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        messageBlock.paddingLeft = "10px";
        messageBlock.paddingRight = "10px";
        messageBlock.paddingTop = "10px";
        messageBlock.paddingBottom = "10px";
        messageBlock.resizeToFit = true;
        scrollViewer.addControl(messageBlock);
        mainPanel.addControl(scrollViewer);

        // Start Game button
        this.popupCloseButton = GUI.Button.CreateSimpleButton("closeButton", buttonText);
        this.popupCloseButton.width = "220px";
        this.popupCloseButton.height = "60px";
        this.popupCloseButton.color = "white";
        this.popupCloseButton.cornerRadius = 12;
        this.popupCloseButton.background = "#4CAF50";
        this.popupCloseButton.fontSize = 26;
        this.popupCloseButton.fontWeight = "bold";
        this.popupCloseButton.thickness = 0;
        this.popupCloseButton.onPointerEnterObservable.add(() => {
            this.popupCloseButton.background = "#43A047";
        });
        this.popupCloseButton.onPointerOutObservable.add(() => {
            this.popupCloseButton.background = "#4CAF50";
        });
        this.popupCloseButton.onPointerClickObservable.clear();
        this.popupCloseButton.onPointerClickObservable.add(() => {
            this.hidePopup();
        });
        mainPanel.addControl(this.popupCloseButton);
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
    
    public setMuted(isMuted: boolean): void {
        this.isMuted = isMuted;
        if (this.audioManager) this.audioManager.setVolume(isMuted ? 0 : 1);
    }
} 