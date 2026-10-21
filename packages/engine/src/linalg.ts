
export type Matrix = number[][];
export type Vector = number[];

export function zeros(n: number): Vector {
return new Array(n).fill(0);
}

export function zeroMatrix(rows: number, cols: number): Matrix {
return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

export function identity(n: number, scale = 1): Matrix {
const m=zeroMatrix(n, n);
for(let i = 0; i < n; i++) m[i]![i] = scale;
return m;
}

export function cholesky(a: Matrix): Matrix | null {
const n=a.length;
const l=zeroMatrix(n, n);
for(let i = 0; i < n; i++){
for(let j = 0; j <= i; j++){
let sum=a[i]![j]!;
for(let k = 0; k < j; k++) sum -= l[i]![k]! * l[j]![k]!;
if(i === j){
if(sum <= 1e-12) return null;
l[i]![j] = Math.sqrt(sum);
}else{
l[i]![j] = sum / l[j]![j]!;
}
}
}
return l;
}

export function choleskySolve(l: Matrix, b: Vector): Vector {
const n=l.length;
const y=zeros(n);
for(let i = 0; i < n; i++){
let sum=b[i]!;
for(let k = 0; k < i; k++) sum -= l[i]![k]! * y[k]!;
y[i]=sum / l[i]![i]!;
}
const x=zeros(n);
for(let i = n - 1; i >= 0; i--){
let sum=y[i]!;
for(let k = i + 1; k < n; k++) sum -= l[k]![i]! * x[k]!;
x[i]=sum / l[i]![i]!;
}
return x;
}

export function choleskyInverse(l: Matrix): Matrix {
const n=l.length;
const inv=zeroMatrix(n, n);
for(let col = 0; col < n; col++){
const e=zeros(n);
e[col]=1;
const x=choleskySolve(l, e);
for(let row = 0; row < n; row++) inv[row]![col] = x[row]!;
}
return inv;
}

export function invert(a: Matrix): Matrix | null {
const l=cholesky(a);
return l ? choleskyInverse(l) : null;
}

export function quadForm(v: Vector, a: Matrix): number {
let total=0;
for(let i = 0; i < v.length; i++){
for(let j = 0; j < v.length; j++){
total += v[i]! * a[i]![j]! * v[j]!;
}
}
return total;
}

export function submatrix(a: Matrix, indices: number[]): Matrix {
return indices.map((i) => indices.map((j) => a[i]![j]!));
}

export function subvector(v: Vector, indices: number[]): Vector {
return indices.map((i) => v[i]!);
}
