<div type="text" 
    bind:clientWidth={width} 
    bind:clientHeight={height} 
    bind:offsetWidth={offsetWidth} 
    bind:offsetHeight={offsetHeight}
/>

<video
    src={clip}
    bind:duration
    bind:buffered
    bind:seekable
    bind:seeking
    bind:played
    bind:ended
></video>

