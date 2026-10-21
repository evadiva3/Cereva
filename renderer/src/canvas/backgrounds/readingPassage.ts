const TITLE="The Garden in Late Spring";
const PARAGRAPHS=[
"By the last week of May the garden had settled into its full green. The " +
"beech hedge, bare and copper through the winter, now held a dense wall " +
"of leaves that moved all at once when the wind came through, the way a " +
"field of wheat moves, and the light that fell past it onto the path " +
"arrived broken into small bright pieces.",
"She walked the same circuit every morning: down the gravel to the pond, " +
"around the old pear tree, back along the wall where the climbing roses " +
"were beginning to open. It was a way of taking attendance. The peonies " +
"had buds the size of marbles, hard and waxy, each one patrolled by ants. " +
"The lettuces needed thinning. A blackbird had built in the ivy again, " +
"in almost exactly the place a blackbird built last year, and she " +
"wondered, as she did every year, whether it was the same bird or only " +
"the same idea occurring to a new one.",
"Reading in the garden after lunch, she noticed how the page itself " +
"changed through the afternoon. At one o'clock the paper was bright " +
"enough to glare; by four the light came in low and yellow and the " +
"letters sat soft and gray on the page. She kept her place with a flat " +
"stone from the path and looked up between chapters at the hedge, the " +
"water, the roses, checking, without meaning to, that everything was " +
"still where she had left it.",
];
export interface WordBox {
word: string;
x: number;
y: number;
w: number;
fontPx: number;
font: string;
}
type WordVisitor=(box: WordBox) => void;

export function paintReadingPassage(
ctx: CanvasRenderingContext2D,
width: number,
height: number,
): void {
ctx.fillStyle="oklch(0.97 0.005 80)";
ctx.fillRect(0, 0, width, height);
ctx.fillStyle="#111111";
walkReadingPassage(ctx, width, height, (box) => {
ctx.fillText(box.word, box.x, box.y);
});
}
export function getReadingPassageWordBoxes(width: number, height: number): WordBox[] {
const canvas=document.createElement("canvas");
canvas.width=1;
canvas.height=1;
const ctx=canvas.getContext("2d")!;
const boxes: WordBox[]=[];
walkReadingPassage(ctx, width, height, (box) => boxes.push(box));
return boxes;
}
function walkReadingPassage(
ctx: CanvasRenderingContext2D,
width: number,
height: number,
visit: WordVisitor,
): void {
const margin=Math.max(32, width * 0.08);
const maxColumn=640;
const columnWidth=Math.min(width - margin * 2, maxColumn);
const left=(width - columnWidth) / 2;
const bodySize=17;
const lineHeight=bodySize * 1.65;
let y=Math.max(48, height * 0.08);
ctx.textBaseline="alphabetic";

const titleSize=width < 480 ? 21 : 26;
ctx.font=`bold ${titleSize}px Georgia, "Times New Roman", serif`;
y=wrapWords(ctx, TITLE, left, y, columnWidth, titleSize * 1.3, titleSize, visit);
y += 14;
ctx.font=`${bodySize}px Georgia, "Times New Roman", serif`;
for(const paragraph of PARAGRAPHS){
y=wrapWords(ctx, paragraph, left, y, columnWidth, lineHeight, bodySize, visit);
y += lineHeight * 0.6;
if(y > height - lineHeight) break;
}
}
function wrapWords(
ctx: CanvasRenderingContext2D,
text: string,
x: number,
y: number,
maxWidth: number,
lineHeight: number,
fontPx: number,
visit: WordVisitor,
): number {
const spaceW=ctx.measureText(" ").width;
const words=text.split(" ");
const font=ctx.font;
let cursor=x;
let lineHasWords=false;
for(const word of words){
const w=ctx.measureText(word).width;
const startX=lineHasWords ? cursor + spaceW : cursor;
if(lineHasWords && startX + w > x + maxWidth){
y += lineHeight;
cursor=x;
visit({ word, x: cursor, y, w, fontPx, font });
cursor += w;
}else{
visit({ word, x: startX, y, w, fontPx, font });
cursor=startX + w;
lineHasWords=true;
}
}
return y + lineHeight;
}
