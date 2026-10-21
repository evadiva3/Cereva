
import {
cholesky,
choleskyInverse,
choleskySolve,
zeroMatrix,
zeros,
type Matrix,
type Vector,
} from "./linalg";

export interface LogisticFit {
beta: Vector;
covariance: Matrix;
converged: boolean;
iterations: number;
}

export interface FitOptions {
priorSd: Vector;
maxIterations?: number;
tolerance?: number;
}

function sigmoid(z: number): number {
if(z >= 0){
const e=Math.exp(-z);
return 1 / (1 + e);
}
const e=Math.exp(z);
return e / (1 + e);
}

export function fitLogistic(x: Matrix, y: Vector, options: FitOptions): LogisticFit | null {
const n=x.length;
if(n === 0) return null;
const p=x[0]!.length;
if(p === 0 || options.priorSd.length !== p) return null;

const maxIt=options.maxIterations ?? 50;
const tol=options.tolerance ?? 1e-8;

const pp=options.priorSd.map((sd) =>
Number.isFinite(sd) && sd > 0 ? 1 / (sd * sd) : 0,
);

let beta=zeros(p);
let converged=false;
let iterations=0;

for(; iterations < maxIt; iterations++){
const eta=new Array<number>(n);
const mu=new Array<number>(n);
const w=new Array<number>(n);
for(let i = 0; i < n; i++){
let z=0;
const row=x[i]!;
for(let j = 0; j < p; j++) z += row[j]! * beta[j]!;
eta[i]=z;
const m=sigmoid(z);
mu[i]=m;
w[i]=Math.max(m * (1 - m), 1e-10);
}

const grad=zeros(p);
const inf=zeroMatrix(p, p);
for(let i = 0; i < n; i++){
const row=x[i]!;
const residual=y[i]! - mu[i]!;
for(let j = 0; j < p; j++){
grad[j]! += row[j]! * residual;
for(let k = j; k < p; k++){
inf[j]![k]! += row[j]! * w[i]! * row[k]!;
}
}
}
for(let j = 0; j < p; j++){
grad[j]! -= pp[j]! * beta[j]!;
inf[j]![j]! += pp[j]!;
for(let k = j + 1; k < p; k++) inf[k]![j] = inf[j]![k]!;
}

const factor=cholesky(inf);
if(!factor) return null;
const step=choleskySolve(factor, grad);

let maxStep=0;
for(let j = 0; j < p; j++){
const bounded=Math.max(-4, Math.min(4, step[j]!));
beta[j]! += bounded;
maxStep=Math.max(maxStep, Math.abs(bounded));
}

if(maxStep < tol){
converged=true;
iterations++;
break;
}
}

const eta=new Array<number>(n);
const w=new Array<number>(n);
for(let i = 0; i < n; i++){
let z=0;
const row=x[i]!;
for(let j = 0; j < p; j++) z += row[j]! * beta[j]!;
eta[i]=z;
const m=sigmoid(z);
w[i]=Math.max(m * (1 - m), 1e-10);
}
const inf=zeroMatrix(p, p);
for(let i = 0; i < n; i++){
const row=x[i]!;
for(let j = 0; j < p; j++){
for(let k = j; k < p; k++) inf[j]![k]! += row[j]! * w[i]! * row[k]!;
}
}
for(let j = 0; j < p; j++){
inf[j]![j]! += pp[j]!;
for(let k = j + 1; k < p; k++) inf[k]![j] = inf[j]![k]!;
}
const factor=cholesky(inf);
if(!factor) return null;

return {
beta,
covariance: choleskyInverse(factor),
converged,
iterations,
};
}

export function normalCdf(z: number): number {
return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
const sign=x < 0 ? -1 : 1;
const ax=Math.abs(x);
const t=1 / (1 + 0.3275911 * ax);
const y =
1 -
((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
0.254829592) *
t *
Math.exp(-ax * ax);
return sign * y;
}

export function waldP(estimate: number, standardError: number): number {
if(!(standardError > 0) || !Number.isFinite(estimate)) return 1;
const z=Math.abs(estimate / standardError);
return Math.max(0, Math.min(1, 2 * (1 - normalCdf(z))));
}

export function chiSquareUpperTail(x: number, df: number): number {
if(!(x > 0)) return 1;
if(df === 2) return Math.exp(-x / 2);
if(df === 1) return 2 * (1 - normalCdf(Math.sqrt(x)));
throw new Error(`chiSquareUpperTail supports df 1 and 2, not ${df}`);
}

export function zForCoverage(coverage: number): number {
const target=1 - (1 - coverage) / 2;
let lo=0;
let hi=10;
for(let i = 0; i < 200; i++){
const mid=(lo + hi) / 2;
if(normalCdf(mid) < target) lo = mid;
else hi = mid;
}
return (lo + hi) / 2;
}
