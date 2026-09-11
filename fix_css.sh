#!/bin/bash
# Remove whatever radio CSS is currently there
sed -i '' '/\/\* Original Uiverse.io Radio Map Modes Component/,$d' app/globals.css

# Append the EXACT original CSS with ONLY the necessary positioning/flex fixes
cat << 'CSS_EOF' >> app/globals.css

/* Original Uiverse.io Radio Map Modes Component - Fixed for sidebar */
.radio-input {
  display: flex;
  height: 210px;
  align-items: center;
}

.glass {
  position: relative; /* REQUIRED for z-index to work */
  z-index: 2;
  height: 110%;
  width: 95px;
  margin-right: 25px;
  padding: 8px;
  background-color: rgba(190, 189, 189, 0.3); /* slightly transparent for dark mode */
  border-radius: 35px;
  box-shadow: rgba(50, 50, 93, 0.2) 0px 25px 50px -10px,
    rgba(0, 0, 0, 0.25) 0px 10px 30px -15px,
    rgba(10, 37, 64, 0.26) 0px -2px 6px 0px inset;
  backdrop-filter: blur(8px);
  flex-shrink: 0; /* REQUIRED to prevent squishing */
}

.glass-inner {
  width: 100%;
  height: 100%;
  border-color: rgba(245, 245, 245, 0.45);
  border-width: 9px;
  border-style: solid;
  border-radius: 30px;
}

.selector {
  display: flex;
  flex-direction: column;
}

.choice {
  margin: 10px 0 10px 0;
  display: flex;
  align-items: center;
}

.choice > div {
  position: relative;
  width: 41px;
  height: 41px;
  margin-right: 15px;
  z-index: 0;
  flex-shrink: 0; /* REQUIRED to prevent squishing circles into ovals */
}

.choice-circle {
  appearance: none;
  height: 100%;
  width: 100%;
  border-radius: 100%;
  border-width: 9px;
  border-style: solid;
  border-color: rgba(245, 245, 245, 0.45);
  cursor: pointer;
  box-shadow: 0px 0px 20px -13px gray, 0px 0px 20px -14px gray inset;
  outline: none; /* remove default outline */
}

.ball {
  z-index: 1;
  position: absolute;
  inset: 0px;
  transform: translateX(-95px);
  box-shadow: rgba(0, 0, 0, 0.17) 0px -10px 10px 0px inset,
    rgba(0, 0, 0, 0.15) 0px -15px 15px 0px inset,
    rgba(0, 0, 0, 0.1) 0px -40px 20px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px,
    rgba(0, 0, 0, 0.09) 0px 4px 2px, rgba(0, 0, 0, 0.09) 0px 8px 4px,
    rgba(0, 0, 0, 0.09) 0px 16px 8px, rgba(0, 0, 0, 0.09) 0px 32px 16px,
    0px -1px 15px -8px rgba(0, 0, 0, 0.09);
  border-radius: 100%;
  transition: transform 800ms cubic-bezier(1, -0.4, 0, 1.4);
  background-color: rgb(232, 232, 232, 1);
  pointer-events: none; /* Let clicks pass through to radio */
}

.choice-circle:checked + .ball {
  transform: translateX(0px);
}

.choice-name {
  color: rgb(177, 176, 176);
  font-size: 14px; /* Scaled down from 35px so text fits */
  font-weight: 900;
  font-family: monospace;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.2;
}
CSS_EOF
