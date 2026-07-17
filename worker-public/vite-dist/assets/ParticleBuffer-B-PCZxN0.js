import{I as e,U as t,W as n,_ as r,a as i,i as a,j as o,o as s,t as c,u as l}from"./Geometry-CZCQfHLF.js";import{i as u}from"./AbstractRenderer-GQgU6Z_I.js";import{t as d}from"./ViewableBuffer-CObpe3su.js";var f=class{constructor(e){this._syncFunctionHash=Object.create(null),this._adaptor=e,this._systemCheck()}_systemCheck(){if(!u())throw Error(`Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.`)}ensureUniformGroup(e){let t=this.getUniformGroupData(e);e.buffer||(e.buffer=new a({data:new Float32Array(t.layout.size/4),usage:i.UNIFORM|i.COPY_DST}))}getUniformGroupData(e){return this._syncFunctionHash[e._signature]||this._initUniformGroup(e)}_initUniformGroup(e){let t=e._signature,n=this._syncFunctionHash[t];if(!n){let r=Object.keys(e.uniformStructures).map(t=>e.uniformStructures[t]),i=this._adaptor.createUboElements(r),a=this._generateUboSync(i.uboElements);n=this._syncFunctionHash[t]={layout:i,syncFunction:a}}return this._syncFunctionHash[t]}_generateUboSync(e){return this._adaptor.generateUboSync(e)}syncUniformGroup(e,t,n){let r=this.getUniformGroupData(e);e.buffer||(e.buffer=new a({data:new Float32Array(r.layout.size/4),usage:i.UNIFORM|i.COPY_DST}));let o=null;return t||(t=e.buffer.data,o=e.buffer.dataInt32),n||(n=0),r.syncFunction(e.uniforms,t,o,n),!0}updateUniformGroup(e){if(e.isStatic&&!e._dirtyId)return!1;e._dirtyId=0;let t=this.syncUniformGroup(e);return e.buffer.update(),t}destroy(){this._syncFunctionHash=null}},p={f32:4,i32:4,"vec2<f32>":8,"vec3<f32>":12,"vec4<f32>":16,"vec2<i32>":8,"vec3<i32>":12,"vec4<i32>":16,"mat2x2<f32>":32,"mat3x3<f32>":48,"mat4x4<f32>":64};function m(e){let t=e.map(e=>({data:e,offset:0,size:0})),n=0,r=0;for(let e=0;e<t.length;e++){let i=t[e];if(n=p[i.data.type],!n)throw Error(`Unknown type ${i.data.type}`);i.data.size>1&&(n=Math.max(n,16)*i.data.size);let a=n===12?16:n;i.size=n;let o=r%16;o>0&&16-o<a?r+=(16-o)%16:r+=(n-o%n)%n,i.offset=r,r+=n}return r=Math.ceil(r/16)*16,{uboElements:t,size:r}}var h=[{type:`mat3x3<f32>`,test:e=>e.value.a!==void 0,ubo:`
            var matrix = uv[name].toArray(true);
            data[offset] = matrix[0];
            data[offset + 1] = matrix[1];
            data[offset + 2] = matrix[2];
            data[offset + 4] = matrix[3];
            data[offset + 5] = matrix[4];
            data[offset + 6] = matrix[5];
            data[offset + 8] = matrix[6];
            data[offset + 9] = matrix[7];
            data[offset + 10] = matrix[8];
        `,uniform:`
            gl.uniformMatrix3fv(ud[name].location, false, uv[name].toArray(true));
        `},{type:`vec4<f32>`,test:e=>e.type===`vec4<f32>`&&e.size===1&&e.value.width!==void 0,ubo:`
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
            data[offset + 2] = v.width;
            data[offset + 3] = v.height;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y || cv[2] !== v.width || cv[3] !== v.height) {
                cv[0] = v.x;
                cv[1] = v.y;
                cv[2] = v.width;
                cv[3] = v.height;
                gl.uniform4f(ud[name].location, v.x, v.y, v.width, v.height);
            }
        `},{type:`vec2<f32>`,test:e=>e.type===`vec2<f32>`&&e.size===1&&e.value.x!==void 0,ubo:`
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y) {
                cv[0] = v.x;
                cv[1] = v.y;
                gl.uniform2f(ud[name].location, v.x, v.y);
            }
        `},{type:`vec4<f32>`,test:e=>e.type===`vec4<f32>`&&e.size===1&&e.value.red!==void 0,ubo:`
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
            data[offset + 3] = v.alpha;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue || cv[3] !== v.alpha) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                cv[3] = v.alpha;
                gl.uniform4f(ud[name].location, v.red, v.green, v.blue, v.alpha);
            }
        `},{type:`vec3<f32>`,test:e=>e.type===`vec3<f32>`&&e.size===1&&e.value.red!==void 0,ubo:`
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                gl.uniform3f(ud[name].location, v.red, v.green, v.blue);
            }
        `}];function g(e,t,n,r){let i=[`
        var v = null;
        var v2 = null;
        var t = 0;
        var index = 0;
        var name = null;
        var arrayOffset = null;
    `],a=0;for(let o=0;o<e.length;o++){let s=e[o],c=s.data.name,l=!1,u=0;for(let e=0;e<h.length;e++)if(h[e].test(s.data)){u=s.offset/4,i.push(`name = "${c}";`,`offset += ${u-a};`,h[e][t]||h[e].ubo),l=!0;break}if(!l)if(s.data.size>1)u=s.offset/4,i.push(n(s,u-a));else{let e=r[s.data.type];u=s.offset/4,i.push(`
                    v = uv.${c};
                    offset += ${u-a};
                    ${e};
                `)}a=u}let o=i.join(`
`);return Function(`uv`,`data`,`dataInt32`,`offset`,o)}function _(e,t){return`
        for (let i = 0; i < ${e*t}; i++) {
            data[offset + (((i / ${e})|0) * 4) + (i % ${e})] = v[i];
        }
    `}var v={f32:`
        data[offset] = v;`,i32:`
        dataInt32[offset] = v;`,"vec2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];`,"vec3<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];`,"vec4<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];`,"vec2<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];`,"vec3<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];`,"vec4<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];
        dataInt32[offset + 3] = v[3];`,"mat2x2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 4] = v[2];
        data[offset + 5] = v[3];`,"mat3x3<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 4] = v[3];
        data[offset + 5] = v[4];
        data[offset + 6] = v[5];
        data[offset + 8] = v[6];
        data[offset + 9] = v[7];
        data[offset + 10] = v[8];`,"mat4x4<f32>":`
        for (let i = 0; i < 16; i++) {
            data[offset + i] = v[i];
        }`,"mat3x2<f32>":_(3,2),"mat4x2<f32>":_(4,2),"mat2x3<f32>":_(2,3),"mat4x3<f32>":_(4,3),"mat2x4<f32>":_(2,4),"mat3x4<f32>":_(3,4)},y={...v,"mat2x2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];
    `};function b(e,t){let n=Math.max(p[e.data.type]/16,1),r=e.data.value.length/e.data.size,i=(4-r%4)%4,a=e.data.type.indexOf(`i32`)>=0?`dataInt32`:`data`;return`
        v = uv.${e.data.name};
        offset += ${t};

        arrayOffset = offset;

        t = 0;

        for(var i=0; i < ${e.data.size*n}; i++)
        {
            for(var j = 0; j < ${r}; j++)
            {
                ${a}[arrayOffset++] = v[t++];
            }
            ${i===0?``:`arrayOffset += ${i};`}
        }
    `}function x(e){return g(e,`uboStd40`,b,v)}var S=class extends f{constructor(){super({createUboElements:m,generateUboSync:x})}};S.extension={type:[n.WebGLSystem],name:`ubo`};var C=class extends t{constructor({buffer:t,offset:n,size:r}){super(),this.uid=e(`buffer`),this._resourceType=`bufferResource`,this._touched=0,this._resourceId=e(`resource`),this._bufferResource=!0,this.destroyed=!1,this.buffer=t,this.offset=n|0,this.size=r,this.buffer.on(`change`,this.onBufferChange,this)}onBufferChange(){this._resourceId=e(`resource`),this.emit(`change`,this)}destroy(e=!1){this.destroyed=!0,e&&this.buffer.destroy(),this.emit(`change`,this),this.buffer=null,this.removeAllListeners()}};function w(e,t){let n=[],i=[`
        var g = s.groups;
        var sS = r.shader;
        var p = s.glProgram;
        var ugS = r.uniformGroup;
        var resources;
    `],a=!1,o=0,c=t._getProgramData(e.glProgram);for(let l in e.groups){let u=e.groups[l];n.push(`
            resources = g[${l}].resources;
        `);for(let d in u.resources){let f=u.resources[d];if(f instanceof s)if(f.ubo){let t=e._uniformBindMap[l][Number(d)];n.push(`
                        sS.bindUniformBlock(
                            resources[${d}],
                            '${t}',
                            ${e.glProgram._uniformBlockData[t].index}
                        );
                    `)}else n.push(`
                        ugS.updateUniformGroup(resources[${d}], p, sD);
                    `);else if(f instanceof C){let t=e._uniformBindMap[l][Number(d)];n.push(`
                    sS.bindUniformBlock(
                        resources[${d}],
                        '${t}',
                        ${e.glProgram._uniformBlockData[t].index}
                    );
                `)}else if(f instanceof r){let r=e._uniformBindMap[l][d],s=c.uniformData[r];s&&(a||(a=!0,i.push(`
                        var tS = r.texture;
                        `)),t._gl.uniform1i(s.location,o),n.push(`
                        tS.bind(resources[${d}], ${o});
                    `),o++)}}}let l=[...i,...n].join(`
`);return Function(`r`,`s`,`sD`,l)}var T=class{},E=class{constructor(e,t){this.program=e,this.uniformData=t,this.uniformGroups={},this.uniformDirtyGroups={},this.uniformBlockBindings={}}destroy(){this.uniformData=null,this.uniformGroups=null,this.uniformDirtyGroups=null,this.uniformBlockBindings=null,this.program=null}};function D(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}function O(e){let t=Array(e);for(let e=0;e<t.length;e++)t[e]=!1;return t}function k(e,t){switch(e){case`float`:return 0;case`vec2`:return new Float32Array(2*t);case`vec3`:return new Float32Array(3*t);case`vec4`:return new Float32Array(4*t);case`int`:case`uint`:case`sampler2D`:case`sampler2DArray`:return 0;case`ivec2`:return new Int32Array(2*t);case`ivec3`:return new Int32Array(3*t);case`ivec4`:return new Int32Array(4*t);case`uvec2`:return new Uint32Array(2*t);case`uvec3`:return new Uint32Array(3*t);case`uvec4`:return new Uint32Array(4*t);case`bool`:return!1;case`bvec2`:return O(2*t);case`bvec3`:return O(3*t);case`bvec4`:return O(4*t);case`mat2`:return new Float32Array([1,0,0,1]);case`mat3`:return new Float32Array([1,0,0,0,1,0,0,0,1]);case`mat4`:return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}return null}var A=null,j={FLOAT:`float`,FLOAT_VEC2:`vec2`,FLOAT_VEC3:`vec3`,FLOAT_VEC4:`vec4`,INT:`int`,INT_VEC2:`ivec2`,INT_VEC3:`ivec3`,INT_VEC4:`ivec4`,UNSIGNED_INT:`uint`,UNSIGNED_INT_VEC2:`uvec2`,UNSIGNED_INT_VEC3:`uvec3`,UNSIGNED_INT_VEC4:`uvec4`,BOOL:`bool`,BOOL_VEC2:`bvec2`,BOOL_VEC3:`bvec3`,BOOL_VEC4:`bvec4`,FLOAT_MAT2:`mat2`,FLOAT_MAT3:`mat3`,FLOAT_MAT4:`mat4`,SAMPLER_2D:`sampler2D`,INT_SAMPLER_2D:`sampler2D`,UNSIGNED_INT_SAMPLER_2D:`sampler2D`,SAMPLER_CUBE:`samplerCube`,INT_SAMPLER_CUBE:`samplerCube`,UNSIGNED_INT_SAMPLER_CUBE:`samplerCube`,SAMPLER_2D_ARRAY:`sampler2DArray`,INT_SAMPLER_2D_ARRAY:`sampler2DArray`,UNSIGNED_INT_SAMPLER_2D_ARRAY:`sampler2DArray`},ee={float:`float32`,vec2:`float32x2`,vec3:`float32x3`,vec4:`float32x4`,int:`sint32`,ivec2:`sint32x2`,ivec3:`sint32x3`,ivec4:`sint32x4`,uint:`uint32`,uvec2:`uint32x2`,uvec3:`uint32x3`,uvec4:`uint32x4`,bool:`uint32`,bvec2:`uint32x2`,bvec3:`uint32x3`,bvec4:`uint32x4`};function M(e,t){if(!A){let t=Object.keys(j);A={};for(let n=0;n<t.length;++n){let r=t[n];A[e[r]]=j[r]}}return A[t]}function N(e,t){return ee[M(e,t)]||`float32`}function P(e,t,n=!1){let r={},i=t.getProgramParameter(e,t.ACTIVE_ATTRIBUTES);for(let n=0;n<i;n++){let i=t.getActiveAttrib(e,n);if(i.name.startsWith(`gl_`))continue;let a=N(t,i.type);r[i.name]={location:0,format:a,stride:l(a).stride,offset:0,instance:!1,start:0}}let a=Object.keys(r);if(n){a.sort((e,t)=>e>t?1:-1);for(let n=0;n<a.length;n++)r[a[n]].location=n,t.bindAttribLocation(e,n,a[n]);t.linkProgram(e)}else for(let n=0;n<a.length;n++)r[a[n]].location=t.getAttribLocation(e,a[n]);return r}function F(e,t){if(!t.ACTIVE_UNIFORM_BLOCKS)return{};let n={},r=t.getProgramParameter(e,t.ACTIVE_UNIFORM_BLOCKS);for(let i=0;i<r;i++){let r=t.getActiveUniformBlockName(e,i);n[r]={name:r,index:t.getUniformBlockIndex(e,r),size:t.getActiveUniformBlockParameter(e,i,t.UNIFORM_BLOCK_DATA_SIZE)}}return n}function I(e,t){let n={},r=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<r;i++){let r=t.getActiveUniform(e,i),a=r.name.replace(/\[.*?\]$/,``),o=!!r.name.match(/\[.*?\]$/),s=M(t,r.type);n[a]={name:a,index:i,type:s,size:r.size,isArray:o,value:k(s,r.size)}}return n}function L(e,t){let n=e.getShaderSource(t).split(`
`).map((e,t)=>`${t}: ${e}`),r=e.getShaderInfoLog(t),i=r.split(`
`),a={},o=i.map(e=>parseFloat(e.replace(/^ERROR\: 0\:([\d]+)\:.*$/,`$1`))).filter(e=>e&&!a[e]?(a[e]=!0,!0):!1),s=[``];o.forEach(e=>{n[e-1]=`%c${n[e-1]}%c`,s.push(`background: #FF0000; color:#FFFFFF; font-size: 10px`,`font-size: 10px`)}),s[0]=n.join(`
`),console.error(r),console.groupCollapsed(`click to view full shader code`),console.warn(...s),console.groupEnd()}function R(e,t,n,r){e.getProgramParameter(t,e.LINK_STATUS)||(e.getShaderParameter(n,e.COMPILE_STATUS)||L(e,n),e.getShaderParameter(r,e.COMPILE_STATUS)||L(e,r),console.error(`PixiJS Error: Could not initialize shader.`),e.getProgramInfoLog(t)!==``&&console.warn(`PixiJS Warning: gl.getProgramInfoLog()`,e.getProgramInfoLog(t)))}function z(e,t){let n=D(e,e.VERTEX_SHADER,t.vertex),r=D(e,e.FRAGMENT_SHADER,t.fragment),i=e.createProgram();e.attachShader(i,n),e.attachShader(i,r);let a=t.transformFeedbackVaryings;a&&(typeof e.transformFeedbackVaryings==`function`?e.transformFeedbackVaryings(i,a.names,a.bufferMode===`separate`?e.SEPARATE_ATTRIBS:e.INTERLEAVED_ATTRIBS):o(`TransformFeedback is not supported but TransformFeedbackVaryings are given.`)),e.linkProgram(i),e.getProgramParameter(i,e.LINK_STATUS)||R(e,i,n,r),t._attributeData=P(i,e,!/^[ \t]*#[ \t]*version[ \t]+300[ \t]+es[ \t]*$/m.test(t.vertex)),t._uniformData=I(i,e),t._uniformBlockData=F(i,e),e.deleteShader(n),e.deleteShader(r);let s={};for(let n in t._uniformData){let r=t._uniformData[n];s[n]={location:e.getUniformLocation(i,n),value:k(r.type,r.size)}}return new E(i,s)}var B={textureCount:0,blockIndex:0},V=class{constructor(e){this._activeProgram=null,this._programDataHash=Object.create(null),this._shaderSyncFunctions=Object.create(null),this._renderer=e}contextChange(e){this._gl=e,this._programDataHash=Object.create(null),this._shaderSyncFunctions=Object.create(null),this._activeProgram=null}bind(e,t){if(this._setProgram(e.glProgram),t)return;B.textureCount=0,B.blockIndex=0;let n=this._shaderSyncFunctions[e.glProgram._key];n||(n=this._shaderSyncFunctions[e.glProgram._key]=this._generateShaderSync(e,this)),this._renderer.buffer.nextBindBase(!!e.glProgram.transformFeedbackVaryings),n(this._renderer,e,B)}updateUniformGroup(e){this._renderer.uniformGroup.updateUniformGroup(e,this._activeProgram,B)}bindUniformBlock(e,t,n=0){let r=this._renderer.buffer,i=this._getProgramData(this._activeProgram),a=e._bufferResource;a||this._renderer.ubo.updateUniformGroup(e);let o=e.buffer,s=r.updateBuffer(o),c=r.freeLocationForBufferBase(s);if(a){let{offset:t,size:n}=e;t===0&&n===o.data.byteLength?r.bindBufferBase(s,c):r.bindBufferRange(s,c,t)}else r.getLastBindBaseLocation(s)!==c&&r.bindBufferBase(s,c);let l=this._activeProgram._uniformBlockData[t].index;i.uniformBlockBindings[n]!==c&&(i.uniformBlockBindings[n]=c,this._renderer.gl.uniformBlockBinding(i.program,l,c))}_setProgram(e){if(this._activeProgram===e)return;this._activeProgram=e;let t=this._getProgramData(e);this._gl.useProgram(t.program)}_getProgramData(e){return this._programDataHash[e._key]||this._createProgramData(e)}_createProgramData(e){let t=e._key;return this._programDataHash[t]=z(this._gl,e),this._programDataHash[t]}destroy(){for(let e of Object.keys(this._programDataHash))this._programDataHash[e].destroy();this._programDataHash=null,this._shaderSyncFunctions=null,this._activeProgram=null,this._renderer=null,this._gl=null}_generateShaderSync(e,t){return w(e,t)}resetState(){this._activeProgram=null}};V.extension={type:[n.WebGLSystem],name:`shader`};var H={f32:`if (cv !== v) {
            cu.value = v;
            gl.uniform1f(location, v);
        }`,"vec2<f32>":`if (cv[0] !== v[0] || cv[1] !== v[1]) {
            cv[0] = v[0];
            cv[1] = v[1];
            gl.uniform2f(location, v[0], v[1]);
        }`,"vec3<f32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            gl.uniform3f(location, v[0], v[1], v[2]);
        }`,"vec4<f32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            cv[3] = v[3];
            gl.uniform4f(location, v[0], v[1], v[2], v[3]);
        }`,i32:`if (cv !== v) {
            cu.value = v;
            gl.uniform1i(location, v);
        }`,"vec2<i32>":`if (cv[0] !== v[0] || cv[1] !== v[1]) {
            cv[0] = v[0];
            cv[1] = v[1];
            gl.uniform2i(location, v[0], v[1]);
        }`,"vec3<i32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            gl.uniform3i(location, v[0], v[1], v[2]);
        }`,"vec4<i32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            cv[3] = v[3];
            gl.uniform4i(location, v[0], v[1], v[2], v[3]);
        }`,u32:`if (cv !== v) {
            cu.value = v;
            gl.uniform1ui(location, v);
        }`,"vec2<u32>":`if (cv[0] !== v[0] || cv[1] !== v[1]) {
            cv[0] = v[0];
            cv[1] = v[1];
            gl.uniform2ui(location, v[0], v[1]);
        }`,"vec3<u32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            gl.uniform3ui(location, v[0], v[1], v[2]);
        }`,"vec4<u32>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            cv[3] = v[3];
            gl.uniform4ui(location, v[0], v[1], v[2], v[3]);
        }`,bool:`if (cv !== v) {
            cu.value = v;
            gl.uniform1i(location, v);
        }`,"vec2<bool>":`if (cv[0] !== v[0] || cv[1] !== v[1]) {
            cv[0] = v[0];
            cv[1] = v[1];
            gl.uniform2i(location, v[0], v[1]);
        }`,"vec3<bool>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            gl.uniform3i(location, v[0], v[1], v[2]);
        }`,"vec4<bool>":`if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {
            cv[0] = v[0];
            cv[1] = v[1];
            cv[2] = v[2];
            cv[3] = v[3];
            gl.uniform4i(location, v[0], v[1], v[2], v[3]);
        }`,"mat2x2<f32>":`gl.uniformMatrix2fv(location, false, v);`,"mat3x3<f32>":`gl.uniformMatrix3fv(location, false, v);`,"mat4x4<f32>":`gl.uniformMatrix4fv(location, false, v);`},U={f32:`gl.uniform1fv(location, v);`,"vec2<f32>":`gl.uniform2fv(location, v);`,"vec3<f32>":`gl.uniform3fv(location, v);`,"vec4<f32>":`gl.uniform4fv(location, v);`,"mat2x2<f32>":`gl.uniformMatrix2fv(location, false, v);`,"mat3x3<f32>":`gl.uniformMatrix3fv(location, false, v);`,"mat4x4<f32>":`gl.uniformMatrix4fv(location, false, v);`,i32:`gl.uniform1iv(location, v);`,"vec2<i32>":`gl.uniform2iv(location, v);`,"vec3<i32>":`gl.uniform3iv(location, v);`,"vec4<i32>":`gl.uniform4iv(location, v);`,u32:`gl.uniform1iv(location, v);`,"vec2<u32>":`gl.uniform2iv(location, v);`,"vec3<u32>":`gl.uniform3iv(location, v);`,"vec4<u32>":`gl.uniform4iv(location, v);`,bool:`gl.uniform1iv(location, v);`,"vec2<bool>":`gl.uniform2iv(location, v);`,"vec3<bool>":`gl.uniform3iv(location, v);`,"vec4<bool>":`gl.uniform4iv(location, v);`};function W(e,t){let n=[`
        var v = null;
        var cv = null;
        var cu = null;
        var t = 0;
        var gl = renderer.gl;
        var name = null;
    `];for(let r in e.uniforms){if(!t[r]){e.uniforms[r]instanceof s?e.uniforms[r].ubo?n.push(`
                        renderer.shader.bindUniformBlock(uv.${r}, "${r}");
                    `):n.push(`
                        renderer.shader.updateUniformGroup(uv.${r});
                    `):e.uniforms[r]instanceof C&&n.push(`
                        renderer.shader.bindBufferResource(uv.${r}, "${r}");
                    `);continue}let i=e.uniformStructures[r],a=!1;for(let e=0;e<h.length;e++){let t=h[e];if(i.type===t.type&&t.test(i)){n.push(`name = "${r}";`,h[e].uniform),a=!0;break}}if(!a){let e=(i.size===1?H:U)[i.type].replace(`location`,`ud["${r}"].location`);n.push(`
            cu = ud["${r}"];
            cv = cu.value;
            v = uv["${r}"];
            ${e};`)}}return Function(`ud`,`uv`,`renderer`,`syncData`,n.join(`
`))}var G=class{constructor(e){this._cache={},this._uniformGroupSyncHash={},this._renderer=e,this.gl=null,this._cache={}}contextChange(e){this.gl=e}updateUniformGroup(e,t,n){let r=this._renderer.shader._getProgramData(t);(!e.isStatic||e._dirtyId!==r.uniformDirtyGroups[e.uid])&&(r.uniformDirtyGroups[e.uid]=e._dirtyId,this._getUniformSyncFunction(e,t)(r.uniformData,e.uniforms,this._renderer,n))}_getUniformSyncFunction(e,t){return this._uniformGroupSyncHash[e._signature]?.[t._key]||this._createUniformSyncFunction(e,t)}_createUniformSyncFunction(e,t){let n=this._uniformGroupSyncHash[e._signature]||(this._uniformGroupSyncHash[e._signature]={}),r=this._getSignature(e,t._uniformData,`u`);return this._cache[r]||(this._cache[r]=this._generateUniformsSync(e,t._uniformData)),n[t._key]=this._cache[r],n[t._key]}_generateUniformsSync(e,t){return W(e,t)}_getSignature(e,t,n){let r=e.uniforms,i=[`${n}-`];for(let e in r)i.push(e),t[e]&&i.push(t[e].type);return i.join(`-`)}destroy(){this._renderer=null,this._cache=null}};G.extension={type:[n.WebGLSystem],name:`uniformGroup`};var K={i32:{align:4,size:4},u32:{align:4,size:4},f32:{align:4,size:4},f16:{align:2,size:2},"vec2<i32>":{align:8,size:8},"vec2<u32>":{align:8,size:8},"vec2<f32>":{align:8,size:8},"vec2<f16>":{align:4,size:4},"vec3<i32>":{align:16,size:12},"vec3<u32>":{align:16,size:12},"vec3<f32>":{align:16,size:12},"vec3<f16>":{align:8,size:6},"vec4<i32>":{align:16,size:16},"vec4<u32>":{align:16,size:16},"vec4<f32>":{align:16,size:16},"vec4<f16>":{align:8,size:8},"mat2x2<f32>":{align:8,size:16},"mat2x2<f16>":{align:4,size:8},"mat3x2<f32>":{align:8,size:24},"mat3x2<f16>":{align:4,size:12},"mat4x2<f32>":{align:8,size:32},"mat4x2<f16>":{align:4,size:16},"mat2x3<f32>":{align:16,size:32},"mat2x3<f16>":{align:8,size:16},"mat3x3<f32>":{align:16,size:48},"mat3x3<f16>":{align:8,size:24},"mat4x3<f32>":{align:16,size:64},"mat4x3<f16>":{align:8,size:32},"mat2x4<f32>":{align:16,size:32},"mat2x4<f16>":{align:8,size:16},"mat3x4<f32>":{align:16,size:48},"mat3x4<f16>":{align:8,size:24},"mat4x4<f32>":{align:16,size:64},"mat4x4<f16>":{align:8,size:32}};function q(e){let t=e.map(e=>({data:e,offset:0,size:0})),n=0;for(let e=0;e<t.length;e++){let r=t[e],i=K[r.data.type].size,a=K[r.data.type].align;if(!K[r.data.type])throw Error(`[Pixi.js] WebGPU UniformBuffer: Unknown type ${r.data.type}`);r.data.size>1&&(i=Math.max(i,a)*r.data.size),n=Math.ceil(n/a)*a,r.size=i,r.offset=n,n+=i}return n=Math.ceil(n/16)*16,{uboElements:t,size:n}}function J(e,t){let{size:n,align:r}=K[e.data.type],i=(r-n)/4,a=e.data.type.indexOf(`i32`)>=0?`dataInt32`:`data`;return`
         v = uv.${e.data.name};
         ${t===0?``:`offset += ${t};`}

         arrayOffset = offset;

         t = 0;

         for(var i=0; i < ${e.data.size*(n/4)}; i++)
         {
             for(var j = 0; j < ${n/4}; j++)
             {
                 ${a}[arrayOffset++] = v[t++];
             }
             ${i===0?``:`arrayOffset += ${i};`}
         }
     `}function Y(e){return g(e,`uboWgsl`,J,y)}var X=class extends f{constructor(){super({createUboElements:q,generateUboSync:Y})}};X.extension={type:[n.WebGPUSystem],name:`ubo`};function Z(e,t=null){let n=e*6;if(n>65535?t||(t=new Uint32Array(n)):t||(t=new Uint16Array(n)),t.length!==n)throw Error(`Out buffer length is incorrect, got ${t.length} and expected ${n}`);for(let e=0,r=0;e<n;e+=6,r+=4)t[e+0]=r+0,t[e+1]=r+1,t[e+2]=r+2,t[e+3]=r+0,t[e+4]=r+2,t[e+5]=r+3;return t}function Q(e){return{dynamicUpdate:$(e,!0),staticUpdate:$(e,!1)}}function $(e,t){let n=[];n.push(`

        var index = 0;

        for (let i = 0; i < ps.length; ++i)
        {
            const p = ps[i];

            `);let r=0;for(let i in e){let a=e[i];if(t!==a.dynamic)continue;n.push(`offset = index + ${r}`),n.push(a.code);let o=l(a.format);r+=o.stride/4}n.push(`
            index += stride * 4;
        }
    `),n.unshift(`
        var stride = ${r};
    `);let i=n.join(`
`);return Function(`ps`,`f32v`,`u32v`,i)}var te=class{constructor(e){this._size=0,this._generateParticleUpdateCache={};let t=this._size=e.size??1e3,n=e.properties,r=0,o=0;for(let e in n){let t=n[e],i=l(t.format);t.dynamic?o+=i.stride:r+=i.stride}this._dynamicStride=o/4,this._staticStride=r/4,this.staticAttributeBuffer=new d(t*4*r),this.dynamicAttributeBuffer=new d(t*4*o),this.indexBuffer=Z(t);let s=new c,u=0,f=0;this._staticBuffer=new a({data:new Float32Array(1),label:`static-particle-buffer`,shrinkToFit:!1,usage:i.VERTEX|i.COPY_DST}),this._dynamicBuffer=new a({data:new Float32Array(1),label:`dynamic-particle-buffer`,shrinkToFit:!1,usage:i.VERTEX|i.COPY_DST});for(let e in n){let t=n[e],r=l(t.format);t.dynamic?(s.addAttribute(t.attributeName,{buffer:this._dynamicBuffer,stride:this._dynamicStride*4,offset:u*4,format:t.format}),u+=r.size):(s.addAttribute(t.attributeName,{buffer:this._staticBuffer,stride:this._staticStride*4,offset:f*4,format:t.format}),f+=r.size)}s.addIndex(this.indexBuffer);let p=this.getParticleUpdate(n);this._dynamicUpload=p.dynamicUpdate,this._staticUpload=p.staticUpdate,this.geometry=s}getParticleUpdate(e){let t=ne(e);return this._generateParticleUpdateCache[t]||(this._generateParticleUpdateCache[t]=this.generateParticleUpdate(e)),this._generateParticleUpdateCache[t]}generateParticleUpdate(e){return Q(e)}update(e,t){e.length>this._size&&(t=!0,this._size=Math.max(e.length,this._size*1.5|0),this.staticAttributeBuffer=new d(this._size*this._staticStride*4*4),this.dynamicAttributeBuffer=new d(this._size*this._dynamicStride*4*4),this.indexBuffer=Z(this._size),this.geometry.indexBuffer.setDataWithSize(this.indexBuffer,this.indexBuffer.byteLength,!0));let n=this.dynamicAttributeBuffer;if(this._dynamicUpload(e,n.float32View,n.uint32View),this._dynamicBuffer.setDataWithSize(this.dynamicAttributeBuffer.float32View,e.length*this._dynamicStride*4,!0),t){let t=this.staticAttributeBuffer;this._staticUpload(e,t.float32View,t.uint32View),this._staticBuffer.setDataWithSize(t.float32View,e.length*this._staticStride*4,!0)}}destroy(){this._staticBuffer.destroy(),this._dynamicBuffer.destroy(),this.geometry.destroy()}};function ne(e){let t=[];for(let n in e){let r=e[n];t.push(n,r.code,r.dynamic?`d`:`s`)}return t.join(`_`)}export{v as A,E as C,S as D,C as E,m as F,f as I,g as M,h as N,x as O,p as P,D as S,w as T,F as _,Y as a,M as b,q as c,U as d,H as f,I as g,R as h,X as i,y as j,b as k,G as l,z as m,Q as n,J as o,V as p,Z as r,K as s,te as t,W as u,P as v,T as w,k as x,N as y};