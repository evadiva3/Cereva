import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { LayerType, SymptomLayer } from "@aura/schema";
import { colors } from "@/theme";
import { layerAnchors, movedConfig, type Anchor } from "./position";
import { canResize, resizedConfig } from "./resize";

export function AuraDrag({layers,selected,onSelect,onChange}:{
layers:SymptomLayer[];selected:LayerType | null;onSelect:(type:LayerType)=>void;
onChange:(type:LayerType,config:SymptomLayer["config"])=>void;
}){
const [bounds,setBounds]=useState({width:1,height:1});
const current=useRef({layers,selected,onSelect,onChange,bounds});
current.current={layers,selected,onSelect,onChange,bounds};
const drag=useRef<{layer:SymptomLayer;anchor:Anchor | undefined;distance:number;pinched:boolean} | null>(null);
const responder=useRef(PanResponder.create({
onStartShouldSetPanResponder:()=>current.current.layers.some(layer => (!current.current.selected || layer.type === current.current.selected) && (layerAnchors(layer).length>0 || canResize(layer))),
onMoveShouldSetPanResponder:(_event,gesture)=>gesture.numberActiveTouches>=2,
onPanResponderGrant:event=>{
const p=current.current;
const available=p.layers.filter(layer => layer.visible && (layerAnchors(layer).length>0 || canResize(layer)));
const chosen=available.find(layer => layer.type === p.selected);
const candidates=(chosen ? [chosen] : available).flatMap<{layer:SymptomLayer;anchor:Anchor | undefined}>(layer => {
const anchors=layerAnchors(layer);
return anchors.length ? anchors.map(anchor=>({layer,anchor})) : [{layer,anchor:undefined}];
});
const {locationX:x,locationY:y}=event.nativeEvent;
candidates.sort((a,b)=>Math.hypot((a.anchor?.x ?? .5)*p.bounds.width-x,(a.anchor?.y ?? .5)*p.bounds.height-y)-Math.hypot((b.anchor?.x ?? .5)*p.bounds.width-x,(b.anchor?.y ?? .5)*p.bounds.height-y));
const candidate=candidates[0];
drag.current=candidate ? {...candidate,distance:0,pinched:false} : null;
if(candidate) p.onSelect(candidate.layer.type);
},
onPanResponderMove:(event,gesture)=>{
const active=drag.current;
if(!active) return;
const p=current.current;
const touches=event.nativeEvent.touches;
if(touches.length>=2){
const first=touches[0]!,second=touches[1]!;
const distance=Math.hypot(first.pageX-second.pageX,first.pageY-second.pageY);
if(!active.pinched){
active.layer=p.layers.find(layer=>layer.type === active.layer.type) ?? active.layer;
active.distance=Math.max(1,distance); active.pinched=true;
return;
}
p.onChange(active.layer.type,resizedConfig(active.layer,active.anchor,distance/active.distance));
}else if(!active.pinched && active.anchor){
p.onChange(active.layer.type,movedConfig(active.layer,active.anchor,gesture.dx/p.bounds.width,gesture.dy/p.bounds.height));
}
},
onPanResponderRelease:()=>{drag.current=null;},
onPanResponderTerminate:()=>{drag.current=null;},
onPanResponderTerminationRequest:()=>false,
})).current;
const active=layers.find(layer=>layer.type === selected);
return <View style={StyleSheet.absoluteFill} {...responder.panHandlers} onLayout={event=>setBounds(event.nativeEvent.layout)} accessible={false}>
{active && layerAnchors(active).map((anchor,index)=><View key={index} pointerEvents="none" style={[styles.handle,{left:anchor.x*bounds.width-12,top:anchor.y*bounds.height-12}]} />)}
</View>;
}
const styles=StyleSheet.create({handle:{position:"absolute",width:24,height:24,borderRadius:12,borderWidth:1.5,borderColor:colors.accent,backgroundColor:"rgba(9,11,12,0.25)"}});
