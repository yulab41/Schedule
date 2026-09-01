#define _XOPEN_SOURCE 700

#include <errno.h>
#include <fcntl.h>
#include <ftw.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static uint64_t file_count = 0;
static uint64_t byte_count = 0;
static uint64_t failure_count = 0;

static int evict_file(const char *path, const struct stat *info, int type, struct FTW *state) {
  (void)state;
  if (type != FTW_F || info == NULL) return 0;
  int descriptor = open(path, O_RDONLY | O_CLOEXEC);
  if (descriptor < 0) {
    failure_count += 1;
    return 0;
  }
  int result = posix_fadvise(descriptor, 0, 0, POSIX_FADV_DONTNEED);
  if (result != 0) failure_count += 1;
  file_count += 1;
  byte_count += (uint64_t)info->st_size;
  close(descriptor);
  return 0;
}

int main(int argument_count, char **arguments) {
  if (argument_count != 2) {
    fputs("usage: drop-file-cache <directory>\n", stderr);
    return 2;
  }
  if (nftw(arguments[1], evict_file, 32, FTW_PHYS) != 0) {
    fprintf(stderr, "nftw failed: %s\n", strerror(errno));
    return 1;
  }
  printf("{\"files\":%llu,\"bytes\":%llu,\"failures\":%llu}\n",
         (unsigned long long)file_count,
         (unsigned long long)byte_count,
         (unsigned long long)failure_count);
  return failure_count == 0 ? 0 : 1;
}
