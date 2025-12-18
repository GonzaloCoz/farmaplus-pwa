const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-4S8qSKY8.js","assets/ui-vendor-CwIRxpyq.js","assets/react-vendor-ylmX0jv_.js","assets/utils-DNiwW225.js","assets/animation-DbfETv0H.js","assets/excel-uoQkVabA.js","assets/index-bt23jcdq.css"])))=>i.map(i=>d[i]);
import{c as v,s as d,ad as f,ae as h,af as b}from"./index-4S8qSKY8.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=v("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]),q={getLabInventory:async(a,s)=>{try{const{data:t,error:r}=await d.from("inventories").select(`
                    id,
                    ean,
                    quantity,
                    system_quantity,
                    status,
                    was_readjusted,
                    products (
                        name,
                        cost,
                        category
                    )
                `).eq("branch_name",a).eq("laboratory",s);return r?(console.error(`Error loading inventory for ${s}:`,r),[]):t.map(o=>{var i,u,e;return{id:o.id,ean:o.ean,name:((i=o.products)==null?void 0:i.name)||"Desconocido",systemQuantity:o.system_quantity||0,countedQuantity:o.quantity,cost:((u=o.products)==null?void 0:u.cost)||0,status:o.status,category:(e=o.products)==null?void 0:e.category,wasReadjusted:o.was_readjusted}})}catch(t){return console.error(`Error loading inventory for ${s}`,t),[]}},saveInventory:async(a,s,t)=>{try{const r=t.map(i=>({branch_name:a,laboratory:s,ean:i.ean,quantity:i.countedQuantity,system_quantity:i.systemQuantity,status:i.status,was_readjusted:i.wasReadjusted||!1}));await d.from("inventories").delete().eq("branch_name",a).eq("laboratory",s);const{error:o}=await d.from("inventories").insert(r);if(o)throw o}catch(r){throw console.error("Error saving inventory:",r),r}},deleteInventory:async(a,s)=>{const{error:t}=await d.from("inventories").delete().eq("branch_name",a).eq("laboratory",s);if(t)throw console.error("Error deleting inventory:",t),t},calculateStats:a=>{let s=0,t=0,r=0,o=0,i=0,u=0;a.forEach(c=>{if(c.status==="controlled"||c.status==="adjusted"){r++;const _=c.countedQuantity-c.systemQuantity,g=_*c.cost;u+=c.systemQuantity,_<0?(s+=g,o+=_):_>0&&(t+=g,i+=_)}});const e=a.length;let n="pendiente";r===e&&e>0?n="controlado":r>0&&(n="por_controlar");const l=e>0?r/e*100:0,y=e>0?Number(l.toFixed(1)):0;return{negative:s,positive:t,net:s+t,progress:y,status:n,negativeUnits:o,positiveUnits:i,netUnits:o+i,totalSystemUnits:u}},getAllCyclicInventories:async a=>{let s=d.from("inventories").select(`
                branch_name,
                laboratory,
                quantity,
                system_quantity,
                status,
                products (
                    name,
                    cost,
                    category
                )
            `);a&&(s=s.eq("branch_name",a));const{data:t,error:r}=await s;if(r||!t)return[];const o={};t.forEach(u=>{var n,l,y;const e=u.laboratory||"Desconocido";o[e]||(o[e]=[]),o[e].push({id:"",ean:"",name:((n=u.products)==null?void 0:n.name)||"",systemQuantity:u.system_quantity||0,countedQuantity:u.quantity,cost:((l=u.products)==null?void 0:l.cost)||0,status:u.status,category:(y=u.products)==null?void 0:y.category})});const i=[];return Object.entries(o).forEach(([u,e])=>{var y;const n=q.calculateStats(e),l=((y=e[0])==null?void 0:y.category)||"Varios";i.push({labName:u,category:l,status:n.status,totalItems:e.length,controlledItems:Math.round(n.progress/100*e.length),progress:n.progress,negativeValue:n.negative,positiveValue:n.positive,netValue:e.reduce((c,_)=>c+_.countedQuantity*_.cost,0),differenceValue:n.net,totalSystemUnits:n.totalSystemUnits,negativeUnits:n.negativeUnits,positiveUnits:n.positiveUnits,netUnits:n.netUnits})}),i},getBranchesSummary:async()=>{const{data:a,error:s}=await d.from("inventories").select(`
                branch_name,
                laboratory,
                quantity,
                system_quantity,
                status,
                products (
                     cost
                )
            `);if(s||!a)return console.error("Error fetching branches summary:",s),[];let t={};const{data:r,error:o}=await d.from("branch_goals").select("branch_name, total_labs_goal");!o&&r&&r.length>0?r.forEach(e=>{t[e.branch_name]=e.total_labs_goal}):(console.warn("No goals found in Supabase, falling back to Excel or 0."),t=await f());const i={};return h.forEach(e=>{i[e]={totalSystemUnits:0,netUnits:0,netValue:0,controlledLabs:new Set,totalLabsInDB:new Set}}),a.forEach(e=>{var y;const n=(e.branch_name||"").trim();if(!n)return;const l=h.find(c=>c.toLowerCase()===n.toLowerCase());if(l){const c=i[l],_=e.laboratory||"Unknown",g=e.quantity||0,m=e.system_quantity||0,p=((y=e.products)==null?void 0:y.cost)||0;c.totalSystemUnits+=m,c.netUnits+=g-m,c.netValue+=(g-m)*p,c.totalLabsInDB.add(_),e.status==="controlado"&&c.controlledLabs.add(_)}}),h.map(e=>{const n=i[e],l=t[e]||0,y=n.controlledLabs.size,c=l>0?y/l*100:0,_=l>0?Number(c.toFixed(1)):0;let g="pendiente";return y>=l&&l>0?g="controlado":y>0&&(g="por_controlar"),{branchName:e,deploymentDate:"01/12/2025",cyclicRound:1,monthlyGoal:l,elapsedDays:12,progress:_,inventoryUnits:n.totalSystemUnits,differenceUnits:n.netUnits,adjustmentsValue:n.netValue,status:g}}).sort((e,n)=>n.progress-e.progress)},getBranchConfig:async a=>{const{data:s}=await d.from("inventories").select("quantity").eq("branch_name",a).eq("laboratory","_CONFIG_").limit(1).maybeSingle();return s?s.quantity:0},saveBranchConfig:async(a,s)=>{try{await b(()=>import("./index-4S8qSKY8.js").then(r=>r.aC),__vite__mapDeps([0,1,2,3,4,5,6])).then(r=>r.ensureConfigProduct()),await d.from("inventories").delete().eq("branch_name",a).eq("laboratory","_CONFIG_");const{error:t}=await d.from("inventories").insert({laboratory:"_CONFIG_",branch_name:a,ean:"CONFIG_DAYS",quantity:s,system_quantity:0,status:"pending"});if(t)throw t}catch(t){throw console.error("Error saving branch config:",t),t}},saveAdjustmentHistory:async(a,s,t)=>{try{const{error:r}=await d.from("inventory_adjustments").insert({branch_name:a,laboratory:s,adjustment_id_shortage:t.adjustment_id_shortage,adjustment_id_surplus:t.adjustment_id_surplus,shortage_value:t.shortage_value,surplus_value:t.surplus_value,total_units_adjusted:t.total_units_adjusted,user_name:t.user_name||"Desconocido"});if(r)throw r;if(t.items_snapshot){const o={net_value:t.adjustment_id_surplus?t.surplus_value:-t.shortage_value,shortage_value:t.shortage_value,surplus_value:t.surplus_value,adjustment_ids:{shortage:t.adjustment_id_shortage,surplus:t.adjustment_id_surplus}},{error:i}=await d.from("inventory_reports").insert({branch_name:a,laboratory:s,snapshot_data:t.items_snapshot,financial_summary:o,user_name:t.user_name||"Desconocido"});i&&console.error("Error saving advanced report snapshot:",i)}}catch(r){throw console.error("Error saving history:",r),r}},getAdjustmentHistory:async(a,s)=>{const{data:t,error:r}=await d.from("inventory_adjustments").select("*").eq("branch_name",a).eq("laboratory",s).order("created_at",{ascending:!1});return r?(console.error("Error fetching history:",r),[]):t},migrateGoalsFromExcel:async()=>{try{console.log("Starting migration...");const a=await f(),s=Object.entries(a).map(([t,r])=>({branch_name:t,total_labs_goal:r,updated_at:new Date().toISOString()}));if(s.length>0){const{error:t}=await d.from("branch_goals").upsert(s,{onConflict:"branch_name"});if(t)throw t;console.log(`Migrated ${s.length} branch goals to Supabase.`)}}catch(a){throw console.error("Migration failed:",a),a}}};export{j as D,q as c};
