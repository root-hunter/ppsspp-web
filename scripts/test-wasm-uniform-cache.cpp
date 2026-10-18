#include "Common/GPU/OpenGL/GLUniformCache.h"
#include <cassert>
#include <cstdio>

int main() {
	GLUniformValueCache first, second;
	uint32_t value[16]{};
	assert(first.Update(2, 1, value, 12));
	assert(!first.Update(2, 1, value, 12));
	assert(second.Update(2, 1, value, 12)); // Different program.
	assert(first.Update(3, 1, value, 12)); // Different uniform.
	value[1] = 0x80000000;
	assert(first.Update(2, 1, value, 12)); // Preserve negative zero.
	assert(!first.Update(2, 1, value, 12));
	value[1] = 0x7fc00001;
	assert(first.Update(2, 1, value, 12));
	assert(!first.Update(2, 1, value, 12));
	value[1] = 0x7fc00002;
	assert(first.Update(2, 1, value, 12)); // Preserve NaN payload bits.
	assert(first.Update(2, 2, value, 12)); // Different uniform setter type.
	assert(first.Update(2, 2, value, 16)); // Different vector size.
	assert(first.Update(4, 3, value, sizeof(value)));
	assert(!first.Update(4, 3, value, sizeof(value)));
	value[15] = 1;
	assert(first.Update(4, 3, value, sizeof(value))); // Last matrix element.
	first.Clear(); // GL relink resets all uniform values.
	assert(first.Update(4, 3, value, sizeof(value)));
	assert(first.Update(-1, 3, value, sizeof(value)));
	assert(first.Update(5, 3, value, 65)); // Unsupported sizes pass through.
	std::puts("Uniform cache: program/type/size isolation, exact bits and relink checks passed");
}
