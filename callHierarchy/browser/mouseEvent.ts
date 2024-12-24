export interface IMouseEvent {
	readonly browserEvent: MouseEvent;
	readonly leftButton: boolean;
	readonly middleButton: boolean;
	readonly rightButton: boolean;
	readonly buttons: number;
	readonly target: HTMLElement;
	readonly detail: number;
	readonly posx: number;
	readonly posy: number;
	readonly ctrlKey: boolean;
	readonly shiftKey: boolean;
	readonly altKey: boolean;
	readonly metaKey: boolean;
	readonly timestamp: number;

	preventDefault(): void;
	stopPropagation(): void;
}