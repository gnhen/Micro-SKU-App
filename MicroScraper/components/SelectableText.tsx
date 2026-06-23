import React from 'react';
import { Platform, Text, TextInput, StyleProp, TextStyle } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  [key: string]: any;
}

function flattenChildren(children: React.ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenChildren).join('');
  return '';
}

// On iOS, <Text selectable> only shows a "Copy" button with no selection handles.
// <TextInput editable={false}> gives full native selection with drag handles.
// On Android, <Text selectable> already works perfectly.
export default function SelectableText({ children, style, numberOfLines, ...rest }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <TextInput
        editable={false}
        multiline
        scrollEnabled={false}
        value={flattenChildren(children)}
        numberOfLines={numberOfLines}
        style={[
          { padding: 0, borderWidth: 0, backgroundColor: 'transparent', margin: 0 },
          style as TextStyle,
        ]}
        {...rest}
      />
    );
  }
  return (
    <Text selectable style={style} numberOfLines={numberOfLines} {...rest}>
      {children}
    </Text>
  );
}
