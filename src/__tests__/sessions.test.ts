import { practiceCue, practiceDuration } from "../relaxation/sessions";
test("breathing changes from inhale to exhale with no hold, and loops",()=>{
expect(practiceCue("breathing",3.9,120).title).toBe("Breathe in");
expect(practiceCue("breathing",4,120)).toMatchObject({title:"Breathe out",remaining:6});
expect(practiceCue("breathing",10,120)).toMatchObject({title:"Breathe in",remaining:4});
});
test("meditation finishes on its closing cue instead of restarting",()=>{
expect(practiceCue("meditation",0,180).title).toBe("Settle");
expect(practiceCue("meditation",180,180).title).toBe("Finish");
expect(practiceCue("meditation",900,180).index).toBe(5);
});
test("invalid duration links fall back to a short session",()=>{
for(const value of [undefined,"-10","NaN","999999","0"]) expect(practiceDuration(value)).toBe(180);
expect(practiceDuration("120")).toBe(120);
expect(practiceDuration("600")).toBe(600);
});
