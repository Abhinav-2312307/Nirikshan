#!/bin/bash
# Remove the existing Radio Map Modes block
sed -i '' '/\/\* Original Uiverse.io Radio Map Modes Component \*\//,$d' app/globals.css

# Append the fixed scaled version
cat << 'CSS_EOF' >> app/globals.css

/* Original Uiverse.io Radio Map Modes Component - Scaled 75% for sidebar */
.radio-input {
  display: flex;
  height: 150px;
  align-items: center;
}

.glass {
  z-index: 2;
  height: 110%;
  width: 70px;
  margin-right: 20px;
  padding: 6px;
  background-color: rgba(190, 189, 189, 0.2);
  border-radius: 26px;
  box-shadow: rgba(50, 50, 93, 0.2) 0px 18px 38px -8px,
    rgba(0, 0, 0, 0.25) 0px 8px 22px -11px,
    rgba(10, 37, 64, 0.26) 0px -2px 5px 0px inset;
  backdrop-filter: blur(8px);
  flex-shrink: 0; /* Prevent squishing */
}

.glass-inner {
  width: 100%;
  height: 100%;
  border-color: rgba(245, 245, 245, 0.45);
  border-width: 7px;
  border-style: solid;
  border-radius: 22px;
}

.selector {
  display: flex;
  flex-direction: column;
}

.choice {
  margin: 8px 0;
  display: flex;
  align-items: center;
}

.choice > div {
  position: relative;
  width: 32px;
  height: 32px;
  margin-right: 12px;
  z-index: 0;
  flex-shrink: 0; /* Prevent squishing */
}

.choice-circle {
  appearance: none;
  height: 100%;
  width: 100%;
  border-radius: 100%;
  border-width: 7px;
  border-style: solid;
  border-color: rgba(245, 245, 245, 0.45);
  cursor: pointer;
  box-shadow: 0px 0px 15px -10px gray, 0px 0px 15px -10px gray inset;
  outline: none;
}

.ball {
  z-index: 1;
  position: absolute;
  inset: 0px;
  transform: translateX(-70px);
  box-shadow: rgba(0, 0, 0, 0.17) 0px -8px 8px 0px inset,
    rgba(0, 0, 0, 0.15) 0px -11px 11px 0px inset,
    rgba(0, 0, 0, 0.1) 0px -30px 15px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px,
    rgba(0, 0, 0, 0.09) 0px 3px 2px, rgba(0, 0, 0, 0.09) 0px 6px 3px,
    rgba(0, 0, 0, 0.09) 0px 12px 6px, rgba(0, 0, 0, 0.09) 0px 24px 12px,
    0px -1px 11px -6px rgba(0, 0, 0, 0.09);
  border-radius: 100%;
  transition: transform 800ms cubic-bezier(1, -0.4, 0, 1.4);
  background-color: rgb(232, 232, 232, 1);
  pointer-events: none;
}

.choice-circle:checked + .ball {
  transform: translateX(0px);
}

.choice-name {
  color: rgb(177, 176, 176);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.3s;
  white-space: nowrap; /* Prevent wrapping */
}

.choice-circle:checked ~ .choice-name {
  color: #fff;
}
CSS_EOF
